import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CartError,
  type CheckedLine,
  needsShipping,
  subtotal,
  toStripeLineItems,
} from "./line-items.ts";

const line = (overrides: Partial<CheckedLine> = {}): CheckedLine => ({
  productId: "p1",
  variantId: null,
  name: "Oak stool",
  unitAmount: 12_500,
  quantity: 2,
  requiresShipping: true,
  ...overrides,
});

test("should build VAT-inclusive GBP line items from server prices", () => {
  const [item] = toStripeLineItems([line({ variantId: "v1" })], "GBP");
  assert.deepEqual(item, {
    quantity: 2,
    price_data: {
      currency: "gbp",
      unit_amount: 12_500,
      tax_behavior: "inclusive",
      product_data: {
        name: "Oak stool",
        metadata: { productId: "p1", variantId: "v1" },
      },
    },
  });
  assert.equal(
    toStripeLineItems([line()], "USD")[0]?.price_data.tax_behavior,
    "exclusive",
  );
});

test("should refuse empty carts, missing prices, and silly quantities", () => {
  assert.throws(() => toStripeLineItems([], "GBP"), CartError);
  assert.throws(
    () => toStripeLineItems([line({ unitAmount: 0 })], "GBP"),
    CartError,
  );
  assert.throws(
    () => toStripeLineItems([line({ unitAmount: 12.5 })], "GBP"),
    CartError,
  );
  assert.throws(
    () => toStripeLineItems([line({ quantity: 0 })], "GBP"),
    CartError,
  );
  assert.throws(
    () => toStripeLineItems([line({ quantity: 100 })], "GBP"),
    CartError,
  );
});

test("should total lines and know when shipping is needed", () => {
  assert.equal(
    subtotal([line(), line({ unitAmount: 1000, quantity: 1 })]),
    26_000,
  );
  assert.equal(needsShipping([line({ requiresShipping: false })]), false);
  assert.equal(
    needsShipping([line({ requiresShipping: false }), line()]),
    true,
  );
});
