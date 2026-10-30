// Creates the plans' products and prices in the Stripe account behind STRIPE_SECRET_KEY, found
// later by lookup key (config.ts PLANS). Safe to re-run: existing lookup keys are left alone.
// Run against a sandbox first: `pnpm --filter @__NAME__/auth stripe:seed`. Amounts are placeholders
// in minor units; client projects set their own before running it in live mode.
import Stripe from "stripe";
import { BILLING_ENV, PLANS } from "../config.ts";

type Amounts = { gbp: number; eur: number; usd: number };

const MONTHLY: Record<(typeof PLANS)[number]["name"], Amounts> = {
  starter: { gbp: 900, eur: 1000, usd: 1200 },
  pro: { gbp: 2900, eur: 3300, usd: 3900 },
};

// Two months free when paying yearly.
const ANNUAL_MONTHS = 10;

// GBP is the settlement currency (UK entity); EUR and USD are offered through currency_options.
function priceParams(
  product: string,
  lookupKey: string,
  amounts: Amounts,
  interval: "month" | "year",
): Stripe.PriceCreateParams {
  return {
    product,
    lookup_key: lookupKey,
    currency: "gbp",
    unit_amount: amounts.gbp,
    // Prices exclude tax; Stripe Tax adds VAT or sales tax at checkout.
    tax_behavior: "exclusive",
    recurring: { interval },
    currency_options: {
      eur: { unit_amount: amounts.eur, tax_behavior: "exclusive" },
      usd: { unit_amount: amounts.usd, tax_behavior: "exclusive" },
    },
  };
}

function times(amounts: Amounts, factor: number): Amounts {
  return {
    gbp: amounts.gbp * factor,
    eur: amounts.eur * factor,
    usd: amounts.usd * factor,
  };
}

async function main(): Promise<void> {
  const secretKey = process.env[BILLING_ENV.secretKey];
  if (!secretKey) throw new Error(`${BILLING_ENV.secretKey} is not set`);
  const stripe = new Stripe(secretKey);
  const mode = secretKey.startsWith("sk_live_") ? "LIVE" : "test";
  console.log(`Seeding plans in Stripe (${mode} mode)`);

  const lookupKeys = PLANS.flatMap((plan) => [
    plan.lookupKey,
    plan.annualDiscountLookupKey,
  ]);
  const existing = await stripe.prices.list({
    lookup_keys: lookupKeys,
    limit: 100,
  });
  const found = new Map(
    existing.data.map((price) => [price.lookup_key, price]),
  );

  for (const plan of PLANS) {
    const monthlyPrice = found.get(plan.lookupKey);
    const annualPrice = found.get(plan.annualDiscountLookupKey);
    if (monthlyPrice && annualPrice) {
      console.log(`  ${plan.title}: already set up`);
      continue;
    }
    // One product per plan: reuse the one an existing price belongs to, so a half-finished run
    // never leaves a second "${plan.title}" in Checkout or the portal's plan switcher.
    const existingProduct = (monthlyPrice ?? annualPrice)?.product;
    const productId =
      typeof existingProduct === "string"
        ? existingProduct
        : (existingProduct?.id ??
          (
            await stripe.products.create({
              name: plan.title,
              metadata: { plan: plan.name },
            })
          ).id);
    const monthly = MONTHLY[plan.name];
    if (!monthlyPrice) {
      await stripe.prices.create(
        priceParams(productId, plan.lookupKey, monthly, "month"),
      );
    }
    if (!annualPrice) {
      await stripe.prices.create(
        priceParams(
          productId,
          plan.annualDiscountLookupKey,
          times(monthly, ANNUAL_MONTHS),
          "year",
        ),
      );
    }
    console.log(`  ${plan.title}: set up on ${productId}`);
  }
}

await main();
