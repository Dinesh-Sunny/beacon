import type { PayloadRequest } from "payload";
import type Stripe from "stripe";
import { SHOP_EVENTS, SHOP_WEBHOOK_SECRET_ENV } from "./config";
import {
  closeCheckoutSession,
  fulfillCheckoutSession,
  recordRefund,
} from "./fulfill";
import { shopStripe } from "./stripe";

// The shop's own Stripe webhook (/api/payments/stripe-checkout/webhooks, its own signing secret),
// separate from organization billing's. Orders are settled here, not on the success page:
// buyers don't always come back (docs/adr/0003-commerce.md). A thrown error answers 500 so Stripe
// retries; everything we don't handle is acknowledged.

const HTTP = { ok: 200, badRequest: 400, unavailable: 503 } as const;

function reply(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

export async function handleShopWebhook(
  req: PayloadRequest,
): Promise<Response> {
  const secret = process.env[SHOP_WEBHOOK_SECRET_ENV];
  if (!secret) {
    console.error(
      `[shop] ${SHOP_WEBHOOK_SECRET_ENV} is not set: webhook refused`,
    );
    return reply(HTTP.unavailable, "Shop webhook not configured");
  }
  const signature = req.headers.get("stripe-signature");
  const body = await req.text?.();
  if (!signature || !body) return reply(HTTP.badRequest, "Missing signature");

  const stripe = shopStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return reply(HTTP.badRequest, "Invalid signature");
  }

  switch (event.type) {
    case SHOP_EVENTS.completed:
    case SHOP_EVENTS.asyncSucceeded:
      await fulfillCheckoutSession(req.payload, event.data.object.id, stripe);
      break;
    case SHOP_EVENTS.asyncFailed:
      await closeCheckoutSession(req.payload, event.data.object, "failed");
      break;
    case SHOP_EVENTS.expired:
      await closeCheckoutSession(req.payload, event.data.object, "expired");
      break;
    case SHOP_EVENTS.refunded:
      await recordRefund(req.payload, event.data.object);
      break;
    default:
      break;
  }
  return reply(HTTP.ok, "Received");
}
