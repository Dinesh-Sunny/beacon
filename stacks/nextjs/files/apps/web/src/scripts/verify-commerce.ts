// End-to-end check of the shop backend against a real Payload and database, with a stand-in
// Stripe client (no network): checkout → paid session → one order → replay → concurrent settle →
// refund → erasure. Run: `pnpm --filter web verify:commerce` (needs `pnpm db:up && pnpm db:migrate`).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "@__NAME__/db";
import config from "@payload-config";
import { getPayload, type PayloadRequest } from "payload";
import Stripe from "stripe";
import { startCheckout } from "@/lib/commerce/checkout";
import { fulfillCheckoutSession, recordRefund } from "@/lib/commerce/fulfill";
import { CartError } from "@/lib/commerce/line-items";
import { handleShopWebhook } from "@/lib/commerce/webhook";
import { eraseShopData } from "@/lib/privacy/erase-shop";
import { siteContext } from "@/lib/tenant";
import { COLLECTIONS, DEFAULT_TENANT_SLUG } from "@/payload/constants";

const payload = await getPayload({ config });
const ctx = { disableRevalidate: true };
const run = randomUUID().slice(0, 8);
const email = `shopper-${run}@example.test`;

const tenant = (
  await payload.find({
    collection: COLLECTIONS.tenants,
    where: { slug: { equals: DEFAULT_TENANT_SLUG } },
    overrideAccess: true,
  })
).docs[0];
assert.ok(tenant, "default tenant");
const other = await payload.create({
  collection: COLLECTIONS.tenants,
  context: ctx,
  overrideAccess: true,
  data: {
    name: `Other ${run}`,
    slug: `other-${run}`,
    status: "active",
  } as never,
});

const product = await payload.create({
  collection: COLLECTIONS.products,
  context: ctx,
  overrideAccess: true,
  draft: false,
  data: {
    tenant: tenant.id,
    title: `Oak stool ${run}`,
    slug: `oak-stool-${run}`,
    priceInGBPEnabled: true,
    priceInGBP: 2500,
    inventory: 5,
    requiresShipping: true,
    _status: "published",
  } as never,
});

async function newCart(tenantId: string | number) {
  const cart = await payload.create({
    collection: COLLECTIONS.carts,
    context: ctx,
    overrideAccess: true,
    data: {
      tenant: tenantId,
      currency: "GBP",
      items: [{ product: product.id, quantity: 2 }],
    } as never,
  });
  const secret = (
    (await payload.db.findOne({
      collection: COLLECTIONS.carts,
      where: { id: { equals: cart.id } },
    })) as { secret?: string } | null
  )?.secret as string;
  return { cart, secret };
}

// Stand-in Stripe: records what checkout asked for and answers with a paid session.
let created: Stripe.Checkout.SessionCreateParams | undefined;
const sessionId = `cs_test_${run}`;
let sessionsCreated = 0;
const fakeStripe = {
  tax: {
    settings: { retrieve: async () => ({ status: "pending" }) },
    registrations: { list: async () => ({ data: [] }) },
  },
  checkout: {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams) => {
        created = params;
        sessionsCreated += 1;
        return {
          id:
            sessionsCreated === 1
              ? sessionId
              : `${sessionId}_${sessionsCreated}`,
          url: `https://checkout.stripe.test/${run}`,
        };
      },
      retrieve: async () => ({
        id: sessionId,
        object: "checkout.session",
        status: "complete",
        payment_status: "paid",
        currency: "gbp",
        amount_subtotal: 5000,
        amount_total: 5450,
        payment_intent: `pi_${run}`,
        metadata: created?.metadata,
        customer_details: { email },
        collected_information: {
          shipping_details: {
            name: "Ada Lovelace",
            address: {
              line1: "1 Mill Lane",
              city: "Bath",
              postal_code: "BA1 1AA",
              country: "GB",
            },
          },
        },
        shipping_cost: { shipping_rate: { display_name: "Standard" } },
      }),
    },
  },
} as unknown as Stripe;

const site = siteContext(tenant, "localhost");
const { cart, secret } = await newCart(tenant.id);

await assert.rejects(
  startCheckout({
    payload,
    site,
    cartId: String(cart.id),
    cartSecret: "wrong",
    stripe: fakeStripe,
  }),
  CartError,
  "a wrong cart secret is refused",
);
// Payload refuses a cart mixing tenants, so move a valid cart under the database to prove
// checkout re-checks the tenant itself.
const otherCart = await newCart(tenant.id);
await payload.db.updateOne({
  collection: COLLECTIONS.carts,
  id: otherCart.cart.id,
  data: { tenant: other.id },
});
await assert.rejects(
  startCheckout({
    payload,
    site,
    cartId: String(otherCart.cart.id),
    cartSecret: otherCart.secret,
    stripe: fakeStripe,
  }),
  CartError,
  "another tenant's cart is refused",
);

const started = await startCheckout({
  payload,
  site,
  cartId: String(cart.id),
  cartSecret: secret,
  stripe: fakeStripe,
});
assert.equal(created?.mode, "payment");
assert.equal(
  created?.line_items?.[0]?.price_data?.unit_amount,
  2500,
  "server price used",
);
assert.equal(created?.metadata?.flow, "shop");
assert.ok(
  created?.shipping_address_collection,
  "physical product asks for an address",
);
assert.equal(
  created?.automatic_tax?.enabled,
  false,
  "tax off without registrations",
);

const [first, concurrent] = await Promise.all([
  fulfillCheckoutSession(payload, sessionId, fakeStripe),
  fulfillCheckoutSession(payload, sessionId, fakeStripe),
]);
assert.equal(first.status, "fulfilled");
assert.equal(concurrent.status, "fulfilled");
const replay = await fulfillCheckoutSession(payload, sessionId, fakeStripe);
assert.ok(first.status === "fulfilled" && replay.status === "fulfilled");
assert.equal(replay.orderId, first.orderId, "replays return the same order");
if (concurrent.status === "fulfilled")
  assert.equal(concurrent.orderId, first.orderId);

const orders = await payload.find({
  collection: COLLECTIONS.orders,
  where: { transactions: { equals: started.transactionId } },
  overrideAccess: true,
});
assert.equal(orders.totalDocs, 1, "exactly one order");
const order = orders.docs[0] as unknown as Record<string, unknown>;
assert.equal(order.amount, 5450);
assert.equal((order.shipping as { city?: string }).city, "Bath");
const stock = await payload.findByID({
  collection: COLLECTIONS.products,
  id: product.id,
  overrideAccess: true,
});
assert.equal(
  (stock as { inventory?: number }).inventory,
  3,
  "stock lowered once",
);

await recordRefund(payload, {
  refunded: true,
  payment_intent: `pi_${run}`,
  amount_refunded: 5450,
  currency: "gbp",
} as Stripe.Charge);
const refunded = await payload.findByID({
  collection: COLLECTIONS.orders,
  id: first.orderId,
  overrideAccess: true,
});
assert.equal(refunded.status, "refunded");
const { rows: audit } = await getDb().$client.query(
  "select action from audit.events where target_id = $1 order by occurred_at",
  [first.orderId],
);
assert.deepEqual(
  audit.map((row) => row.action),
  ["order.created", "order.refunded"],
);

// The webhook: signature checked before anything runs, then routed by event type. An expired
// session closes its pending transaction (handled from the event alone, no Stripe call).
process.env.SHOP_STRIPE_WEBHOOK_SECRET ??= `whsec_verify_${run}`;
process.env.STRIPE_SECRET_KEY ??= `sk_test_verify_${run}`;
const webhookSecret = process.env.SHOP_STRIPE_WEBHOOK_SECRET;
const second = await newCart(tenant.id);
const pending = await startCheckout({
  payload,
  site,
  cartId: String(second.cart.id),
  cartSecret: second.secret,
  stripe: fakeStripe,
});
const body = JSON.stringify({
  id: `evt_${run}`,
  object: "event",
  type: "checkout.session.expired",
  data: {
    object: {
      id: `${sessionId}_${sessionsCreated}`,
      object: "checkout.session",
      metadata: created?.metadata,
    },
  },
});
const webhookReq = (signature: string) =>
  ({
    payload,
    headers: new Headers({ "stripe-signature": signature }),
    text: async () => body,
  }) as unknown as PayloadRequest;
const forged = await handleShopWebhook(webhookReq("t=1,v1=forged"));
assert.equal(forged.status, 400, "a forged signature is refused");
const signed = Stripe.webhooks.generateTestHeaderString({
  payload: body,
  secret: webhookSecret,
});
const delivered = await handleShopWebhook(webhookReq(signed));
assert.equal(delivered.status, 200);
const expired = await payload.findByID({
  collection: COLLECTIONS.transactions,
  id: pending.transactionId,
  overrideAccess: true,
});
assert.equal(
  expired.status,
  "expired",
  "expired session closes its transaction",
);

const erased = await eraseShopData(randomUUID(), email);
assert.equal(erased.orders, 1);
const pseudonymized = (await payload.findByID({
  collection: COLLECTIONS.orders,
  id: first.orderId,
  overrideAccess: true,
})) as unknown as Record<string, unknown>;
assert.equal(pseudonymized.customerEmail ?? null, null);
assert.equal(
  (pseudonymized.shipping as { city?: string | null }).city ?? null,
  null,
);
assert.equal(
  (pseudonymized.shipping as { country?: string }).country,
  "GB",
  "country kept",
);

await payload.delete({
  collection: COLLECTIONS.tenants,
  id: other.id,
  context: ctx,
  overrideAccess: true,
});
console.log("commerce: ok");
process.exit(0);
