import assert from "node:assert/strict";
import { test } from "node:test";
import { devConsoleEmailSender, latestDevEmail } from "./email.ts";

test("should return the latest link per kind when an address gets several emails", async (t) => {
  t.mock.method(console, "info", () => {});
  await devConsoleEmailSender({
    kind: "magic-link",
    to: "Outbox@Example.com",
    url: "http://localhost/first",
  });
  await devConsoleEmailSender({
    kind: "magic-link",
    to: "outbox@example.com",
    url: "http://localhost/second",
  });
  await devConsoleEmailSender({
    kind: "reset-password",
    to: "outbox@example.com",
    url: "http://localhost/reset",
  });
  assert.deepEqual(latestDevEmail("magic-link", " OUTBOX@example.com "), {
    kind: "magic-link",
    to: "outbox@example.com",
    url: "http://localhost/second",
  });
  assert.equal(
    latestDevEmail("reset-password", "outbox@example.com")?.url,
    "http://localhost/reset",
  );
  assert.equal(latestDevEmail("verify-email", "outbox@example.com"), undefined);
});
