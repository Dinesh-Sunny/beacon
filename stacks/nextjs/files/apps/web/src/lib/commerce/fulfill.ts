import { getDb, recordAuditEvent } from "@__NAME__/db";
import { createLocalReq, type Payload } from "payload";
import type Stripe from "stripe";
import { COLLECTIONS } from "@/payload/constants";
import type { Tenant, Transaction } from "@/payload-types";
import { SHOP_FLOW, SHOP_PAYMENT_METHOD } from "./config";
import { STRIPE_CONTEXT_KEY, shopStripe } from "./stripe";

// Settles a paid Checkout Session into exactly one order (docs/adr/0003-commerce.md). Called from
// the shop webhook and the success page; safe to run any number of times, concurrently too: the
// plugin's finalizeOrder claims the transaction atomically and later calls get the same order.

export type FulfillResult =
  | { status: "fulfilled"; orderId: string }
  | { status: "pending" }
  | { status: "ignored" };

const CONFIRM_ORDER_PATH = `/payments/${SHOP_PAYMENT_METHOD}/confirm-order`;

export class FulfillmentError extends Error {
  override name = "FulfillmentError";
}

export function isShopSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.flow === SHOP_FLOW;
}

export async function findTransactionBySession(
  payload: Payload,
  sessionId: string,
): Promise<Transaction | null> {
  const { docs } = await payload.find({
    collection: COLLECTIONS.transactions,
    where: { "stripeCheckout.checkoutSessionID": { equals: sessionId } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
  });
  return docs[0] ?? null;
}

// The plugin's confirm-order endpoint is the only way to reach finalizeOrder (it isn't exported),
// so it is invoked in-process with a local request. The path is pinned by a test.
function confirmOrderHandler(payload: Payload) {
  const endpoint = payload.config.endpoints.find(
    (candidate) =>
      candidate.path === CONFIRM_ORDER_PATH && candidate.method === "post",
  );
  if (!endpoint) {
    throw new FulfillmentError(
      `Ecommerce endpoint ${CONFIRM_ORDER_PATH} not registered`,
    );
  }
  return endpoint.handler;
}

async function recordOrderCreated(
  payload: Payload,
  tenantId: string,
  orderId: string,
  amount: number,
  currency: string,
): Promise<void> {
  const tenant = (await payload.findByID({
    collection: COLLECTIONS.tenants,
    id: tenantId,
    overrideAccess: true,
    depth: 0,
    disableErrors: true,
  })) as Tenant | null;
  await recordAuditEvent(getDb().$client, {
    action: "order.created",
    organizationId: tenant?.organizationId ?? null,
    target: { type: "order", id: orderId },
    metadata: { amount, currency },
  }).catch((error: unknown) => {
    console.error("[shop] couldn't record order in the audit log", {
      error: error instanceof Error ? error.name : "unknown",
    });
  });
}

function settledOrderId(transaction: Transaction | null): string | null {
  if (transaction?.status !== "succeeded" || !transaction.order) return null;
  const order = transaction.order;
  return String(typeof order === "object" ? order.id : order);
}

export async function fulfillCheckoutSession(
  payload: Payload,
  sessionId: string,
  stripe: Stripe = shopStripe(),
): Promise<FulfillResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!isShopSession(session)) return { status: "ignored" };
  // Delayed payment methods complete the session unpaid; async_payment_succeeded settles later.
  if (session.payment_status === "unpaid") return { status: "pending" };

  const transaction = await findTransactionBySession(payload, sessionId);
  if (!transaction)
    throw new FulfillmentError("No transaction for this session");
  const settled = settledOrderId(transaction);
  if (settled) return { status: "fulfilled", orderId: settled };

  const cartId =
    typeof transaction.cart === "object"
      ? transaction.cart?.id
      : transaction.cart;
  const cart = cartId
    ? await payload.findByID({
        collection: COLLECTIONS.carts,
        id: cartId,
        overrideAccess: true,
        depth: 0,
        disableErrors: true,
      })
    : null;
  if (!cart) throw new FulfillmentError("The transaction's cart is gone");
  const email = session.customer_details?.email;
  if (!email) throw new FulfillmentError("Stripe returned no buyer email");

  const req = await createLocalReq(
    { context: { [STRIPE_CONTEXT_KEY]: stripe } },
    payload,
  );
  req.data = {
    cartID: cart.id,
    secret: (cart as { secret?: string }).secret,
    customerEmail: email,
    checkoutSessionID: session.id,
  };
  const response = await confirmOrderHandler(payload)(req);
  if (!response.ok) {
    // Stripe can deliver completed and async_payment_succeeded at once: the plugin lets only
    // one create the order, so the other finds it settled here instead of failing the webhook.
    const winner = settledOrderId(
      await findTransactionBySession(payload, sessionId),
    );
    if (winner) return { status: "fulfilled", orderId: winner };
    throw new FulfillmentError(
      `Order confirmation failed with ${response.status}`,
    );
  }
  const { orderID } = (await response.json()) as { orderID?: string | number };
  if (orderID === undefined) throw new FulfillmentError("No order was created");
  const tenantId = session.metadata?.tenantId;
  if (tenantId) {
    await recordOrderCreated(
      payload,
      tenantId,
      String(orderID),
      session.amount_total ?? 0,
      (session.currency ?? "").toUpperCase(),
    );
  }
  return { status: "fulfilled", orderId: String(orderID) };
}

// A session that will never be paid: its transaction stops counting as pending.
export async function closeCheckoutSession(
  payload: Payload,
  session: Stripe.Checkout.Session,
  status: "failed" | "expired",
): Promise<void> {
  if (!isShopSession(session)) return;
  const transaction = await findTransactionBySession(payload, session.id);
  if (transaction?.status !== "pending") return;
  await payload.update({
    collection: COLLECTIONS.transactions,
    id: transaction.id,
    overrideAccess: true,
    data: { status },
  });
}

// A refund made in the Stripe Dashboard: a full refund marks the order refunded. Charges don't
// carry the session's metadata, so the transaction is found by its payment intent.
export async function recordRefund(
  payload: Payload,
  charge: Stripe.Charge,
): Promise<void> {
  if (!charge.refunded || !charge.payment_intent) return;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent.id;
  const { docs } = await payload.find({
    collection: COLLECTIONS.transactions,
    where: { "stripeCheckout.paymentIntentID": { equals: paymentIntentId } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
  });
  const transaction = docs[0];
  // Not a shop payment (organization billing), or already recorded.
  if (!transaction || transaction.status === "refunded") return;
  await payload.update({
    collection: COLLECTIONS.transactions,
    id: transaction.id,
    overrideAccess: true,
    data: { status: "refunded" },
  });
  const orderId =
    typeof transaction.order === "object"
      ? transaction.order?.id
      : transaction.order;
  if (!orderId) return;
  await payload.update({
    collection: COLLECTIONS.orders,
    id: orderId,
    overrideAccess: true,
    data: { status: "refunded" },
  });
  const tenantId = (transaction as { tenant?: unknown }).tenant;
  const tenant =
    typeof tenantId === "string"
      ? ((await payload.findByID({
          collection: COLLECTIONS.tenants,
          id: tenantId,
          overrideAccess: true,
          depth: 0,
          disableErrors: true,
        })) as Tenant | null)
      : null;
  await recordAuditEvent(getDb().$client, {
    action: "order.refunded",
    organizationId: tenant?.organizationId ?? null,
    target: { type: "order", id: String(orderId) },
    metadata: {
      amount: charge.amount_refunded,
      currency: charge.currency.toUpperCase(),
    },
  });
}
