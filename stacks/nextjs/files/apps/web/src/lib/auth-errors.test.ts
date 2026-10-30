import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorMessage } from "./auth-errors.ts";

test("should fall back to plain text when the code is an Object.prototype key", () => {
  for (const code of ["__proto__", "constructor", "toString"]) {
    assert.equal(typeof authErrorMessage({ code }), "string");
  }
});

test("should explain a known code in plain words", () => {
  assert.match(authErrorMessage({ code: "TOKEN_EXPIRED" }), /expired/);
});
