import assert from "node:assert/strict";
import { test } from "node:test";
import { FILTERED, scrubQueryString, scrubUrl } from "./scrub.ts";

test("should filter secret query values and keep the rest when a URL has a token", () => {
  assert.equal(
    scrubUrl(
      "https://example.com/api/auth/verify-email?token=abc.def&callbackURL=%2F",
    ),
    `https://example.com/api/auth/verify-email?token=${FILTERED}&callbackURL=%2F`,
  );
});

test("should filter the secret path segment when a reset link is recorded", () => {
  assert.equal(
    scrubUrl(
      "https://example.com/api/auth/reset-password/abc123?callbackURL=%2Freset",
    ),
    `https://example.com/api/auth/reset-password/${FILTERED}?callbackURL=%2Freset`,
  );
  assert.equal(scrubUrl("/admin/reset/xyz"), `/admin/reset/${FILTERED}`);
  assert.equal(
    scrubUrl("/accept-invitation/2f0c/extra"),
    `/accept-invitation/${FILTERED}/extra`,
  );
  assert.equal(
    scrubUrl("/api/c15t/subjects/sub_abc"),
    `/api/c15t/subjects/${FILTERED}`,
  );
});

test("should match secret params regardless of case", () => {
  assert.equal(
    scrubUrl("/x?Token=1&OTP=2"),
    `/x?Token=${FILTERED}&OTP=${FILTERED}`,
  );
});

test("should leave a URL without secrets unchanged", () => {
  assert.equal(
    scrubUrl("/sign-in?next=%2Faccount"),
    "/sign-in?next=%2Faccount",
  );
  assert.equal(scrubUrl("https://example.com/"), "https://example.com/");
});

test("should scrub a bare query string with or without its question mark", () => {
  assert.equal(scrubQueryString("token=a&page=2"), `token=${FILTERED}&page=2`);
  assert.equal(scrubQueryString("?code=9"), `?code=${FILTERED}`);
});
