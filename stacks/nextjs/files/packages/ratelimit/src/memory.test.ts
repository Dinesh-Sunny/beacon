import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeInMemory } from "./memory.ts";

const RULE = { max: 2, windowSeconds: 60 };

test("should allow up to the limit in memory, then block until the window ends", () => {
  const scope = `mem-${crypto.randomUUID()}`;
  const now = 1_000_000;
  assert.equal(consumeInMemory(scope, "a", RULE, now).allowed, true);
  assert.equal(consumeInMemory(scope, "a", RULE, now).allowed, true);
  const blocked = consumeInMemory(scope, "a", RULE, now + 10_000);
  assert.deepEqual(blocked, { allowed: false, retryAfterSeconds: 50 });
  assert.equal(consumeInMemory(scope, "a", RULE, now + 60_000).allowed, true);
});

test("should refuse a rule with no window", () => {
  assert.throws(
    () => consumeInMemory("mem", "a", { max: 1, windowSeconds: 0 }),
    RangeError,
  );
});
