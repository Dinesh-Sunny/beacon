// In-memory limits for the model routes: one Space, one process, so Maps are enough. Reset on restart.
// Each route has its own per-IP bucket; a daily request cap and a daily token cap are shared, so one
// route cannot spend another's quota and malformed requests never count (callers validate first).

const MINUTE_MS = 60_000;
const MAX_TRACKED_IPS = 10_000;

export type Route = "check" | "explain" | "letter" | "mcp";

export type LimitResult =
  | { ok: true }
  | { ok: false; reason: "ip" | "daily" | "tokens" };

const buckets = new Map<Route, Map<string, number[]>>();
let day = "";
let dayRequests = 0;
let dayTokens = 0;

function rollDay(now: number): void {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today === day) return;
  day = today;
  dayRequests = 0;
  dayTokens = 0;
}

/** Drops the least recently seen IPs (Map keeps insertion order) instead of resetting everyone. */
function evict(bucket: Map<string, number[]>): void {
  const extra = bucket.size - MAX_TRACKED_IPS;
  if (extra <= 0) return;
  let i = 0;
  for (const key of bucket.keys()) {
    if (i++ >= extra) break;
    bucket.delete(key);
  }
}

export interface Limits {
  perMinute: number;
  dailyRequests: number;
  dailyTokens: number;
}

/** Takes `weight` slots for this IP on this route. Call only after the body has been validated. */
export function takeSlot(
  route: Route,
  ip: string,
  limits: Limits,
  weight = 1,
  now = Date.now(),
): LimitResult {
  rollDay(now);
  if (dayTokens >= limits.dailyTokens) return { ok: false, reason: "tokens" };
  if (dayRequests + weight > limits.dailyRequests)
    return { ok: false, reason: "daily" };

  const bucket = buckets.get(route) ?? new Map<string, number[]>();
  buckets.set(route, bucket);
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < MINUTE_MS);
  if (recent.length + weight > limits.perMinute) {
    bucket.delete(ip);
    bucket.set(ip, recent);
    return { ok: false, reason: "ip" };
  }
  for (let i = 0; i < weight; i++) recent.push(now);
  bucket.delete(ip);
  bucket.set(ip, recent);
  evict(bucket);
  dayRequests += weight;
  return { ok: true };
}

/** Adds model tokens spent today, from each step's usage. */
export function recordTokens(tokens: number, now = Date.now()): void {
  rollDay(now);
  dayTokens += Math.max(0, tokens);
}

/**
 * The client address. HF Spaces (and most proxies) append the address they saw to
 * X-Forwarded-For, so the right-most entry is the one a client cannot forge.
 */
export function clientIp(headers: Headers): string {
  const hops = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops?.at(-1) || headers.get("x-real-ip") || "unknown";
}

export const BUSY_MESSAGE: Record<
  Exclude<LimitResult, { ok: true }>["reason"],
  string
> = {
  ip: "Lots of people are using Beacon right now. Try again in about 2 minutes.",
  daily:
    "Lots of people are checking today. Please try again tomorrow, or see the example.",
  tokens:
    "Beacon has done all the reading it can for today. Please try again tomorrow, or see the example.",
};

export class BodyTooLargeError extends Error {
  override name = "BodyTooLargeError";
}

/** Reads a JSON body without buffering more than `maxBytes` (chunked bodies included). */
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}
