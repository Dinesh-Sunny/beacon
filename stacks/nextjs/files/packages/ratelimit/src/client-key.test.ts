import assert from "node:assert/strict";
import { test } from "node:test";
import { clientKey, UNKNOWN_CLIENT } from "./client-key.ts";

test("should key IPv4 clients by their address", () => {
  assert.equal(clientKey("203.0.113.7"), "203.0.113.7");
  assert.equal(clientKey("::ffff:203.0.113.7"), "203.0.113.7");
});

test("should collapse IPv6 to the /64 so rotating addresses share a bucket", () => {
  assert.equal(clientKey("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(
    clientKey("2001:0db8:0001:0002:ffff:0:0:9"),
    "2001:db8:1:2::/64",
  );
  assert.equal(clientKey("2001:db8::1"), "2001:db8:0:0::/64");
});

test("should put missing or forged values in one shared bucket", () => {
  assert.equal(clientKey(null), UNKNOWN_CLIENT);
  assert.equal(clientKey("not-an-ip"), UNKNOWN_CLIENT);
  assert.equal(clientKey("x".repeat(8000)), UNKNOWN_CLIENT);
  assert.equal(clientKey("1.2.3.4, 5.6.7.8"), UNKNOWN_CLIENT);
});
