import { MAX_LINE_QUANTITY, TAX_BEHAVIOR } from "./config.ts";

// Turns checked cart lines into Stripe Checkout line items. Pure: prices come from the server's
// own read of products (never the cart's stored subtotal), so it can be tested on its own.

export type ShopCurrencyCode = keyof typeof TAX_BEHAVIOR;

export type CheckedLine = {
  productId: string;
  variantId: string | null;
  name: string;
  // Minor units (pence, cents) in the session currency.
  unitAmount: number;
  quantity: number;
  requiresShipping: boolean;
};

export class CartError extends Error {
  override name = "CartError";
}

export function assertValidLines(lines: readonly CheckedLine[]): void {
  if (lines.length === 0) throw new CartError("The cart is empty.");
  for (const line of lines) {
    if (!Number.isInteger(line.unitAmount) || line.unitAmount <= 0) {
      throw new CartError(`${line.name} has no price in this currency.`);
    }
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_LINE_QUANTITY
    ) {
      throw new CartError(`${line.name} has an invalid quantity.`);
    }
  }
}

export function toStripeLineItems(
  lines: readonly CheckedLine[],
  currency: ShopCurrencyCode,
) {
  assertValidLines(lines);
  return lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: line.unitAmount,
      tax_behavior: TAX_BEHAVIOR[currency],
      product_data: {
        name: line.name,
        metadata: {
          productId: line.productId,
          ...(line.variantId && { variantId: line.variantId }),
        },
      },
    },
  }));
}

export function subtotal(lines: readonly CheckedLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
}

export function needsShipping(lines: readonly CheckedLine[]): boolean {
  return lines.some((line) => line.requiresShipping);
}
