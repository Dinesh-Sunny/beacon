import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import type { Endpoint } from "payload";
import { SHOP_PAYMENT_METHOD } from "@/lib/commerce/config";
import { COLLECTIONS } from "../constants";

// Our Stripe Checkout Sessions adapter for the ecommerce plugin (docs/adr/0003-commerce.md):
// Adaptive Pricing and Stripe Tax, which the plugin's PaymentIntents adapter can't do. Services
// load inside handlers so the Payload CLI (migrations, types) doesn't import Stripe code.

const NOT_IMPLEMENTED = 501;

type SessionLike = {
  id: string;
  status: string | null;
  payment_status: string;
  currency: string | null;
  amount_subtotal: number | null;
  amount_total: number | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
  collected_information?: {
    shipping_details?: {
      name?: string | null;
      address?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postal_code?: string | null;
        country?: string | null;
      } | null;
    } | null;
  } | null;
  shipping_cost?: {
    shipping_rate?: string | { display_name?: string | null } | null;
  } | null;
};

const webhookEndpoint: Endpoint = {
  path: "/webhooks",
  method: "post",
  handler: async (req) => {
    const { handleShopWebhook } = await import("@/lib/commerce/webhook");
    return handleShopWebhook(req);
  },
};

export const stripeCheckoutAdapter: PaymentAdapter = {
  name: SHOP_PAYMENT_METHOD,
  label: "Card and wallets (Stripe Checkout)",
  group: {
    name: "stripeCheckout",
    type: "group",
    admin: {
      condition: (data) => data?.paymentMethod === SHOP_PAYMENT_METHOD,
    },
    fields: [
      {
        name: "checkoutSessionID",
        label: "Checkout Session ID",
        type: "text",
        index: true,
      },
      {
        name: "paymentIntentID",
        label: "PaymentIntent ID",
        type: "text",
        index: true,
      },
    ],
  },
  // Checkout starts from our own server action (lib/commerce/checkout.ts), which resolves the
  // tenant from the request host. The plugin's public /initiate endpoint isn't used.
  initiatePayment: () => {
    throw Object.assign(new Error("Start checkout from the cart page."), {
      status: NOT_IMPLEMENTED,
    });
  },
  confirmOrder: async ({ data, finalizeOrder, req }) => {
    const sessionId = data.checkoutSessionID;
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("Checkout Session ID is required");
    }
    const { shopStripe, STRIPE_CONTEXT_KEY } = await import(
      "@/lib/commerce/stripe"
    );
    const { findTransactionBySession } = await import("@/lib/commerce/fulfill");
    // The fulfilment service passes its client along (one client per settlement, and tests).
    const stripe =
      (req.context[STRIPE_CONTEXT_KEY] as
        | ReturnType<typeof shopStripe>
        | undefined) ?? shopStripe();
    const session = (await stripe.checkout.sessions.retrieve(
      sessionId,
    )) as unknown as SessionLike;
    const paid =
      session.status === "complete" &&
      (session.payment_status === "paid" ||
        session.payment_status === "no_payment_required");
    if (!paid) throw new Error("The session isn't paid");
    const transaction = await findTransactionBySession(req.payload, session.id);
    if (
      !transaction ||
      String(transaction.id) !== session.metadata?.transactionId
    ) {
      throw new Error("The session doesn't match its transaction");
    }
    // Our own currency and pre-tax total; Adaptive Pricing only changes what the buyer sees.
    if (
      session.currency?.toUpperCase() !== transaction.currency ||
      session.amount_subtotal !== transaction.amount
    ) {
      throw new Error("The paid amount doesn't match the transaction");
    }
    const paymentIntentID =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    await req.payload.update({
      collection: COLLECTIONS.transactions,
      id: transaction.id,
      data: {
        stripeCheckout: { checkoutSessionID: session.id, paymentIntentID },
      } as never,
      req,
    });
    const shipping = session.collected_information?.shipping_details;
    const rate = session.shipping_cost?.shipping_rate;
    const order = await finalizeOrder({
      transactionID: transaction.id,
      orderData: {
        tenant: (transaction as { tenant?: unknown }).tenant,
        ...(session.metadata?.customerId && {
          customer: session.metadata.customerId,
        }),
        customerEmail: data.customerEmail,
        amount: session.amount_total,
        currency: transaction.currency,
        items: transaction.items,
        status: "processing",
        ...(shipping?.address && {
          shipping: {
            name: shipping.name,
            line1: shipping.address.line1,
            line2: shipping.address.line2,
            city: shipping.address.city,
            postalCode: shipping.address.postal_code,
            country: shipping.address.country,
            rate: typeof rate === "object" && rate ? rate.display_name : null,
          },
        }),
      },
    });
    return {
      message: "Order confirmed",
      orderID: order.id as string,
      transactionID: transaction.id,
    };
  },
  endpoints: [webhookEndpoint],
};
