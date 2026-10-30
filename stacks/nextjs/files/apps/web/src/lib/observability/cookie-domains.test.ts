import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieDomains } from "./cookie-domains.ts";

test("should list the host and every parent domain", () => {
  assert.deepEqual(cookieDomains("www.example.co.uk"), [
    "www.example.co.uk",
    "example.co.uk",
    "co.uk",
  ]);
});

test("should return nothing extra for a single-label host like localhost", () => {
  assert.deepEqual(cookieDomains("localhost"), []);
});

test("should return nothing for IP addresses, which only hold host-only cookies", () => {
  assert.deepEqual(cookieDomains("127.0.0.1"), []);
  assert.deepEqual(cookieDomains("[::1]"), []);
});
