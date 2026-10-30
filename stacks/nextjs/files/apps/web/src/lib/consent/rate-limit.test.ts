import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_IP_HEADER, CONSENT_RATE_LIMITS } from "./config.ts";
import { limitConsentRequest } from "./rate-limit.ts";

const URL_ = "http://localhost:3000/api/c15t/subjects";

function request(method: string, ip: string): Request {
  return new Request(URL_, { method, headers: { [CLIENT_IP_HEADER]: ip } });
}

// Each test uses its own documentation-range /64, so runs against a shared store never collide.
test("should refuse saves past the limit with 429 and Retry-After", async () => {
  const ip = `2001:db8:${crypto.randomUUID().slice(0, 4)}::1`;
  for (let i = 0; i < CONSENT_RATE_LIMITS.save.max; i++) {
    assert.equal(await limitConsentRequest(request("POST", ip)), null);
  }
  const blocked = await limitConsentRequest(request("POST", ip));
  assert.ok(blocked);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);
});

test("should count reads apart from saves", async () => {
  const ip = `2001:db8:${crypto.randomUUID().slice(0, 4)}::2`;
  for (let i = 0; i <= CONSENT_RATE_LIMITS.save.max; i++) {
    await limitConsentRequest(request("POST", ip));
  }
  assert.equal(await limitConsentRequest(request("GET", ip)), null);
});
