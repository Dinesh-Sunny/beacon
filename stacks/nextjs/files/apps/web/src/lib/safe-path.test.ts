import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSafeRelativePath } from "./safe-path.ts";

describe("isSafeRelativePath", () => {
  test("should accept same-site paths with query and hash", () => {
    for (const path of [
      "/account",
      "/accept-invitation/abc?x=1",
      "/account#security",
    ]) {
      assert.equal(isSafeRelativePath(path), true, path);
    }
  });

  test("should reject paths that a browser would send to another host", () => {
    for (const path of [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "https://evil.example",
      "evil.example",
      "",
    ]) {
      assert.equal(isSafeRelativePath(path), false, JSON.stringify(path));
    }
  });
});
