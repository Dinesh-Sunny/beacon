import { Redis } from "@upstash/redis";
import {
  RATELIMIT_ENV,
  RATELIMIT_PREFIX,
  RATELIMIT_TIMEOUT_MS,
} from "./config.ts";
import { consumeInMemory } from "./memory.ts";
import {
  type LimitResult,
  type LimitRule,
  retryAfterSeconds,
  windowMs,
} from "./rule.ts";

// Fixed window, counted and expired in one atomic step so concurrent requests can't all slip
// past a stale read. The expiry is set whenever the key has none (not only on the first hit), so
// a key that lost its TTL can't block forever. Plain Lua on purpose: @upstash/ratelimit's scripts
// use an Upstash-only shebang flag that open-source Redis rejects, so they can't run in local dev
// or CI.
const CONSUME_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

function firstSet(names: readonly string[]): string | undefined {
  return names.map((name) => process.env[name]).find(Boolean);
}

export function isRateLimitConfigured(): boolean {
  return Boolean(firstSet(RATELIMIT_ENV.url) && firstSet(RATELIMIT_ENV.token));
}

let redis: Redis | undefined;

function getRedis(): Redis {
  redis ??= Redis.fromEnv({
    // No retry backoff and a hard deadline: a limiter that waits slows every request it guards.
    retry: false,
    signal: () => AbortSignal.timeout(RATELIMIT_TIMEOUT_MS),
  });
  return redis;
}

// Counts one request for `key` under `scope` in Upstash and says whether it is within `rule`.
// Throws when Upstash isn't configured or unreachable; most callers want consumeWithFallback.
export async function consume(
  scope: string,
  key: string,
  rule: LimitRule,
): Promise<LimitResult> {
  const [count, ttlMs] = await getRedis().eval<string[], [number, number]>(
    CONSUME_SCRIPT,
    [`${RATELIMIT_PREFIX}:${scope}:${key}`],
    [String(windowMs(rule))],
  );
  return count <= rule.max
    ? { allowed: true, retryAfterSeconds: null }
    : { allowed: false, retryAfterSeconds: retryAfterSeconds(ttlMs) };
}

// Upstash when configured and reachable; otherwise a per-instance memory count. Weaker (each
// instance counts alone) but never unlimited, so an outage or a used-up quota can't switch off
// sign-in protection. Only the error's name is logged: Upstash error messages echo the command,
// which contains the client IP.
export async function consumeWithFallback(
  scope: string,
  key: string,
  rule: LimitRule,
): Promise<LimitResult> {
  if (!isRateLimitConfigured()) return consumeInMemory(scope, key, rule);
  try {
    return await consume(scope, key, rule);
  } catch (error) {
    console.error("[ratelimit] store unavailable, counting in memory", {
      scope,
      error: error instanceof Error ? error.name : "unknown",
    });
    return consumeInMemory(scope, key, rule);
  }
}
