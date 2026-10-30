import assert from "node:assert/strict";
import { test } from "node:test";
import { aiReferrer } from "./ai-referrer.ts";

test("should name AI assistants by host and subdomain, and nothing else", () => {
  assert.equal(aiReferrer("https://chatgpt.com/c/123"), "chatgpt");
  assert.equal(
    aiReferrer("https://www.perplexity.ai/search?q=x"),
    "perplexity",
  );
  assert.equal(aiReferrer("https://claude.ai/chat/abc"), "claude");
  assert.equal(aiReferrer("https://notchatgpt.com/"), null);
  assert.equal(aiReferrer("https://www.google.com/"), null);
  assert.equal(aiReferrer(""), null);
});
