import assert from "node:assert/strict";
import { test } from "node:test";
import { RATELIMIT_PREFIX } from "./config.ts";
import {
  consume,
  type consumeWithFallback,
  isRateLimitConfigured,
} from "./limiter.ts";
import { retryAfterSeconds } from "./rule.ts";

test("should round retry-after up so clients never retry early", () => {
  assert.equal(retryAfterSeconds(10_001), 11);
  assert.equal(retryAfterSeconds(500), 1);
});

test("should never ask for a retry-after below one second", () => {
  assert.equal(retryAfterSeconds(-1), 1);
});

// Integration: needs Upstash or the local Serverless Redis HTTP container (`pnpm db:up`). CI
// provides one, so these never skip there.
const skip = !isRateLimitConfigured() && "Upstash not configured";
const RULE = { max: 2, windowSeconds: 60 };

test("should allow up to the limit, then block with a retry-after", {
  skip,
}, async () => {
  const scope = `test-${crypto.randomUUID()}`;
  assert.equal((await consume(scope, "client-1", RULE)).allowed, true);
  assert.equal((await consume(scope, "client-1", RULE)).allowed, true);
  const blocked = await consume(scope, "client-1", RULE);
  assert.equal(blocked.allowed, false);
  assert.ok(
    blocked.retryAfterSeconds !== null && blocked.retryAfterSeconds <= 60,
  );
  assert.equal((await consume(scope, "client-2", RULE)).allowed, true);
});

test("should count concurrent requests atomically", { skip }, async () => {
  const scope = `test-${crypto.randomUUID()}`;
  const results = await Promise.all(
    Array.from({ length: 10 }, () => consume(scope, "burst", RULE)),
  );
  assert.equal(results.filter((result) => result.allowed).length, RULE.max);
});

test("should give a key that lost its expiry a fresh window instead of blocking forever", {
  skip,
}, async () => {
  const scope = `test-${crypto.randomUUID()}`;
  const { Redis } = await import("@upstash/redis");
  await Redis.fromEnv().set(`${RATELIMIT_PREFIX}:${scope}:stuck`, 99);
  const result = await consume(scope, "stuck", RULE);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterSeconds !== null && result.retryAfterSeconds > 1);
});

test("should fall back to counting in memory when the store is unreachable", {
  skip,
}, async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9";
  try {
    // A fresh scope still goes through the cached client, so point a new module at the bad URL.
    const fresh = await import(`./limiter.ts?unreachable=${Date.now()}`);
    const limit = fresh.consumeWithFallback as typeof consumeWithFallback;
    const scope = `test-unreachable-${crypto.randomUUID()}`;
    assert.equal((await limit(scope, "client", RULE)).allowed, true);
    assert.equal((await limit(scope, "client", RULE)).allowed, true);
    assert.equal((await limit(scope, "client", RULE)).allowed, false);
  } finally {
    process.env.UPSTASH_REDIS_REST_URL = url;
  }
});
