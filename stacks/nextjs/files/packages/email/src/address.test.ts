import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAddress, parseAddressList } from "./address.ts";

test("should split a display name from the address", () => {
  assert.deepEqual(parseAddress("__NAME__ <hello@mail.example.com>"), {
    name: "__NAME__",
    address: "hello@mail.example.com",
  });
});

test("should return only the address when there is no display name", () => {
  assert.deepEqual(parseAddress(" <hi@example.com> "), {
    address: "hi@example.com",
  });
  assert.deepEqual(parseAddress("hi@example.com"), {
    address: "hi@example.com",
  });
});

test("should drop the quotes around a display name", () => {
  assert.deepEqual(parseAddress('"Doe, Jane" <jane@example.com>'), {
    name: "Doe, Jane",
    address: "jane@example.com",
  });
});

test("should keep quoted commas inside one recipient when splitting a list", () => {
  assert.deepEqual(
    parseAddressList('"Doe, Jane" <jane@example.com>, sam@example.com,'),
    [
      { name: "Doe, Jane", address: "jane@example.com" },
      { address: "sam@example.com" },
    ],
  );
});
