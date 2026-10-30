import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice, visitorCurrency } from "./billing-currency.ts";

test("should show GBP in the UK, EUR in the euro area, USD elsewhere", () => {
  assert.equal(visitorCurrency("GB"), "gbp");
  assert.equal(visitorCurrency("de"), "eur");
  assert.equal(visitorCurrency("US"), "usd");
  assert.equal(visitorCurrency("CH"), "usd");
  assert.equal(visitorCurrency(null), "usd");
});

test("should drop pence for whole amounts", () => {
  assert.equal(formatPrice(900, "gbp", "en-GB"), "£9");
  assert.equal(formatPrice(999, "gbp", "en-GB"), "£9.99");
});
