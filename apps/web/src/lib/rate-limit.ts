// In-memory limits for /api/check: one Space, one process, so a Map is enough. Resets on restart.

const perIp = new Map<string, number[]>();
let day = "";
let dayCount = 0;

const MINUTE_MS = 60_000;

export type LimitResult = { ok: true } | { ok: false; reason: "ip" | "daily" };

export function takeCheckSlot(
  ip: string,
  perMinute: number,
  dailyCap: number,
  now = Date.now(),
): LimitResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= dailyCap) return { ok: false, reason: "daily" };

  const recent = (perIp.get(ip) ?? []).filter((t) => now - t < MINUTE_MS);
  if (recent.length >= perMinute) {
    perIp.set(ip, recent);
    return { ok: false, reason: "ip" };
  }
  recent.push(now);
  perIp.set(ip, recent);
  dayCount += 1;
  if (perIp.size > 10_000) perIp.clear();
  return { ok: true };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
