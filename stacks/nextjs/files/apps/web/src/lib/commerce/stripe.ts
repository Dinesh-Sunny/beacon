import { BILLING_ENV } from "@__NAME__/auth/config";
import Stripe from "stripe";
import type { Tenant } from "@/payload-types";

// One Stripe account per deployment takes every tenant's sales (docs/adr/0003-commerce.md).
// Every shop call goes through here, so Stripe Connect later only adds `{ stripeAccount }`.

export class ShopNotConfiguredError extends Error {
  override name = "ShopNotConfiguredError";
}

let client: Stripe | undefined;

// Request-context key the fulfilment service uses to hand its Stripe client to the adapter.
export const STRIPE_CONTEXT_KEY = "shopStripe";

export function shopStripe(_tenant?: Pick<Tenant, "id">): Stripe {
  const secretKey = process.env[BILLING_ENV.secretKey];
  if (!secretKey) {
    throw new ShopNotConfiguredError(
      `${BILLING_ENV.secretKey} is not set: the shop can't take payments`,
    );
  }
  client ??= new Stripe(secretKey);
  return client;
}
