import assert from "node:assert/strict";
import { test } from "node:test";
import { absoluteLinks, escapeMarkdown, markdownLink } from "./markdown.ts";

test("should escape Markdown syntax an editor typed, and leave punctuation alone", () => {
  assert.equal(escapeMarkdown("Six weeks. Oak, ash!"), "Six weeks. Oak, ash!");
  assert.equal(escapeMarkdown("# Not a heading"), "\\# Not a heading");
  assert.equal(
    escapeMarkdown("- not a list\n1. nor this"),
    "\\- not a list\n1\\. nor this",
  );
  assert.equal(
    escapeMarkdown("a *b* [c](d) <e>"),
    "a \\*b\\* \\[c\\](d) \\<e\\>",
  );
});

test("should wrap link targets and make site paths absolute", () => {
  assert.equal(
    markdownLink("Quote [now]", "https://x.test/a b"),
    "[Quote \\[now\\]](<https://x.test/a b>)",
  );
  assert.equal(
    absoluteLinks(
      "See [About](/about) and [x](https://y.test)",
      (path) => `https://site.test${path}`,
    ),
    "See [About](<https://site.test/about>) and [x](https://y.test)",
  );
});
