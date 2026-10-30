import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactLetter } from "../letter.ts";

const clean = (text: string): string => redactLetter(text).text;

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
  it("should remove spaced card, sort code and account numbers", () => {
    assert.equal(clean("Card 4111 1111 1111 1111"), "Card [card number]");
    assert.equal(clean("Card 4111-1111-1111-1111"), "Card [card number]");
    assert.equal(clean("Sort code 12 34 56"), "Sort code [sort code]");
    assert.equal(clean("Account 1234 5678"), "Account [number]");
  });
  it("should remove full postcodes and the greeting line", () => {
    assert.equal(
      clean("Dear Mrs Patel,\n1 High Road, London HA9 0AA"),
      "[greeting]\n1 High Road, London [postcode]",
    );
  });
  it("should keep phone numbers the letter says to call, and dates", () => {
    const letter =
      "Call 0800 731 0122 or phone 08007310122 by 14 November 2026.";
    assert.equal(clean(letter), letter);
  });
  it("should remove a long number that is not given as a phone number", () => {
    assert.equal(clean("Reference 01234567890"), "Reference [number]");
  });
});
