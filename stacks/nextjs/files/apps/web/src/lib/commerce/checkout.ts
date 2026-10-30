import { timingSafeEqual } from "node:crypto";
import { isStripeTaxReady } from "@__NAME__/auth";
import type { Payload } from "payload";
import type Stripe from "stripe";
import type { SiteContext } from "@/lib/tenant";
import { COLLECTIONS, DEFAULT_SHOP_CURRENCY } from "@/payload/constants";
import { tenantIdOf } from "@/payload/hooks/tenant-id";
import type { Cart, Product, Tenant, Variant } from "@/payload-types";
import {
  CHECKOUT_EXPIRY_MINUTES,
  SHOP_FLOW,
  SHOP_INTEGRATION_IDENTIFIER,
  SHOP_PAYMENT_METHOD,
} from "./config";
import {
  CartError,
  type CheckedLine,
  needsShipping,
  type ShopCurrencyCode,
  subtotal,
  toStripeLineItems,
} from "./line-items";
import { shopStripe } from "./stripe";

// Starts a Stripe Checkout for a cart (docs/adr/0003-commerce.md). Prices, stock, and tenant are
// read here on the server: the cart's stored subtotal and anything the browser sends are never
// trusted (the plugin's own variant check doesn't run, payloadcms#18339).

const MINUTE_MS = 60_000;

export type CheckoutRequest = {
  payload: Payload;
  site: SiteContext;
  cartId: string;
  cartSecret: string;
  // A signed-in buyer (app host only): linked to the order and pre-filled at checkout.
  buyer?: { customerId: string; email: string } | null;
  // Injected in tests; defaults to the shop's client.
  stripe?: Stripe;
};

export type CheckoutStart = { url: string; transactionId: string };

function sameSecret(given: string, stored: unknown): boolean {
  if (typeof stored !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

function relationId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function priceOf(
  doc: Product | Variant,
  currency: ShopCurrencyCode,
): number | null {
  const record = doc as unknown as Record<string, unknown>;
  if (record[`priceIn${currency}Enabled`] !== true) return null;
  const price = record[`priceIn${currency}`];
  return typeof price === "number" ? price : null;
}

function inStock(doc: Product | Variant, quantity: number): boolean {
  const inventory = (doc as { inventory?: number | null }).inventory;
  return typeof inventory !== "number" || inventory >= quantity;
}

export function shopCurrency(tenant: Tenant): ShopCurrencyCode {
  return (tenant.shop?.currency ?? DEFAULT_SHOP_CURRENCY) as ShopCurrencyCode;
}

// Reads the cart as the server sees it: secret checked, same tenant, published products with a
// price in the site's currency and enough stock.
async function checkedLines(
  payload: Payload,
  cart: Cart,
  tenantId: string,
  currency: ShopCurrencyCode,
): Promise<CheckedLine[]> {
  const lines: CheckedLine[] = [];
  for (const item of cart.items ?? []) {
    const productId = relationId(item.product);
    if (!productId) throw new CartError("A cart item has no product.");
    const product = await payload.findByID({
      collection: COLLECTIONS.products,
      id: productId,
      draft: false,
      overrideAccess: false,
      depth: 0,
      disableErrors: true,
    });
    if (!product || tenantIdOf(product) !== tenantId) {
      throw new CartError("A product in the cart isn't available.");
    }
    const variantId = relationId(item.variant);
    const variant = variantId
      ? await payload.findByID({
          collection: COLLECTIONS.variants,
          id: variantId,
          draft: false,
          overrideAccess: false,
          depth: 0,
          disableErrors: true,
        })
      : null;
    if (variantId && (!variant || relationId(variant.product) !== productId)) {
      throw new CartError(`${product.title} isn't available in that option.`);
    }
    const priced = variant ?? product;
    const unitAmount = priceOf(priced, currency);
    if (unitAmount === null) {
      throw new CartError(`${product.title} has no price in ${currency}.`);
    }
    if (!inStock(priced, item.quantity)) {
      throw new CartError(`Not enough ${product.title} in stock.`);
    }
    lines.push({
      productId,
      variantId,
      name: variant?.title
        ? `${product.title} (${variant.title})`
        : product.title,
      unitAmount,
      quantity: item.quantity,
      requiresShipping: product.requiresShipping !== false,
    });
  }
  return lines;
}

function shippingParams(
  tenant: Tenant,
  currency: ShopCurrencyCode,
): Pick<
  Stripe.Checkout.SessionCreateParams,
  "shipping_address_collection" | "shipping_options"
> {
  const countries = (tenant.shop?.shipsTo ?? [
    "GB",
  ]) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  const rates = tenant.shop?.shippingRates ?? [];
  return {
    shipping_address_collection: { allowed_countries: countries },
    ...(rates.length > 0 && {
      shipping_options: rates.map((rate) => ({
        shipping_rate_data: {
          type: "fixed_amount" as const,
          display_name: rate.label,
          fixed_amount: {
            amount: rate.amount,
            currency: currency.toLowerCase(),
          },
        },
      })),
    }),
  };
}

export async function startCheckout({
  payload,
  site,
  cartId,
  cartSecret,
  buyer,
  stripe = shopStripe(site.tenant),
}: CheckoutRequest): Promise<CheckoutStart> {
  const tenant = site.tenant;
  const cart = await payload.findByID({
    collection: COLLECTIONS.carts,
    id: cartId,
    overrideAccess: true,
    depth: 0,
    disableErrors: true,
  });
  if (!cart || !sameSecret(cartSecret, (cart as { secret?: unknown }).secret)) {
    throw new CartError("Your cart has expired. Add the items again.");
  }
  if (cart.purchasedAt) throw new CartError("This cart was already paid for.");
  if (tenantIdOf(cart) !== tenant.id) {
    throw new CartError("This cart belongs to another shop.");
  }
  const currency = shopCurrency(tenant);
  if (cart.currency && cart.currency !== currency) {
    throw new CartError(
      "Prices in this cart changed currency. Add the items again.",
    );
  }
  const lines = await checkedLines(payload, cart, tenant.id, currency);
  const lineItems = toStripeLineItems(lines, currency);

  const transaction = await payload.create({
    collection: COLLECTIONS.transactions,
    overrideAccess: true,
    data: {
      tenant: tenant.id,
      cart: cart.id,
      ...(buyer ? { customer: buyer.customerId } : {}),
      amount: subtotal(lines),
      currency,
      paymentMethod: SHOP_PAYMENT_METHOD,
      status: "pending",
      items: lines.map((line) => ({
        product: line.productId,
        ...(line.variantId && { variant: line.variantId }),
        quantity: line.quantity,
      })),
    } as never,
  });

  const metadata = {
    flow: SHOP_FLOW,
    tenantId: tenant.id,
    transactionId: String(transaction.id),
    cartId: String(cart.id),
    ...(buyer && { customerId: buyer.customerId }),
  };
  const origin = site.origin.toString().replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    automatic_tax: { enabled: await isStripeTaxReady(stripe) },
    adaptive_pricing: { enabled: true },
    allow_promotion_codes: true,
    ...(buyer && { customer_email: buyer.email }),
    ...(needsShipping(lines) && shippingParams(tenant, currency)),
    client_reference_id: String(transaction.id),
    metadata,
    payment_intent_data: { metadata },
    expires_at: Math.floor(
      (Date.now() + CHECKOUT_EXPIRY_MINUTES * MINUTE_MS) / 1000,
    ),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
    integration_identifier: SHOP_INTEGRATION_IDENTIFIER,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");

  await payload.update({
    collection: COLLECTIONS.transactions,
    id: transaction.id,
    overrideAccess: true,
    data: { stripeCheckout: { checkoutSessionID: session.id } } as never,
  });
  return { url: session.url, transactionId: String(transaction.id) };
}
