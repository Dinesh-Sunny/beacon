import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseSiteHref } from "./site-href.ts";

describe("parseSiteHref", () => {
  test("should treat same-site paths as internal", () => {
    assert.deepEqual(parseSiteHref("/pricing#plans"), {
      kind: "internal",
      href: "/pricing#plans",
    });
    assert.deepEqual(parseSiteHref("  /about "), {
      kind: "internal",
      href: "/about",
    });
  });

  test("should accept https and mailto as external", () => {
    assert.equal(parseSiteHref("https://example.com/a")?.kind, "external");
    assert.equal(parseSiteHref("mailto:hello@example.com")?.kind, "external");
  });

  test("should reject script, data, plain http, and protocol-relative links", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,hi",
      "http://example.com",
      "//evil.example",
      "/\\evil.example",
      "example.com",
      "",
    ]) {
      assert.equal(parseSiteHref(href), null, JSON.stringify(href));
    }
  });
});
