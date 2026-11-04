import "server-only";

// Spend guard for the public demo: per-IP rate, a daily cap, and same-origin requests only.
// In memory per server instance, which is enough for a demo; real deployments would use a store.

const perIp = new Map<string, number[]>();
let day = "";
let dayCount = 0;

const PER_MIN = Number(process.env.BEACON_PER_IP_PER_MINUTE || 20);
const DAILY = Number(process.env.BEACON_DAILY_CAP || 2000);

export type GuardFail = { status: number; message: string };

export function guard(req: Request, weight = 1): GuardFail | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host)
    return { status: 403, message: "Cross-site requests are not allowed" };
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount + weight > DAILY)
    return { status: 429, message: "Beacon is very busy today" };
  const recent = (perIp.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MIN)
    return { status: 429, message: "Slow down a little" };
  recent.push(now);
  perIp.set(ip, recent);
  if (perIp.size > 10_000) perIp.clear();
  dayCount += weight;
  return null;
}
