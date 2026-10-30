import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactLetter } from "../letter.ts";

describe("letter redaction", () => {
  it("should remove NI numbers, sort codes and account numbers", () => {
    const { text, removed } = redactLetter(
      "NI number QQ 12 34 56 C. Sort code 12-34-56, account 12345678.",
    );
    assert.equal(
      text,
      "NI number [NI number]. Sort code [sort code], account [number].",
    );
    assert.equal(removed, 3);
  });
  it("should keep phone numbers and dates for the scam check", () => {
    const letter = "Call 0800 731 0122 or 08007310122 by 14 November 2026.";
    assert.deepEqual(redactLetter(letter), { text: letter, removed: 0 });
  });
});
