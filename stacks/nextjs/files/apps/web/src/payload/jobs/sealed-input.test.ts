import assert from "node:assert/strict";
import { test } from "node:test";
import { openJobInput, sealJobInput } from "./sealed-input.ts";

const SECRET = "test-secret-at-least-32-characters-long";
const EMAIL = {
  kind: "magic-link",
  to: "a@example.test",
  url: "https://x.test/?token=abc",
};

test("should round-trip sealed input without exposing it", () => {
  const sealed = sealJobInput(EMAIL, SECRET);
  assert.ok(!sealed.includes("token=abc"));
  assert.ok(!sealed.includes("a@example.test"));
  assert.deepEqual(openJobInput(sealed, SECRET), EMAIL);
});

test("should refuse input sealed with another secret or tampered with", () => {
  const sealed = sealJobInput(EMAIL, SECRET);
  assert.throws(() => openJobInput(sealed, `${SECRET}-other`));
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => openJobInput(parts.join("."), SECRET));
  assert.throws(() => openJobInput("v0.a.b.c", SECRET));
});
