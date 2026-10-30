<!-- last-verified: 2026-10-03 -->
# Commerce

How the shop backend works: products, carts, hosted Stripe Checkout, webhook-driven orders, and per-tenant settings. For developers on a client fork who configure, test, or change the shop. Decision: docs/adr/0003-commerce.md. Engine options: docs/knowledge/commerce-options.md. The storefront pages are not built yet (docs/plans/2026-10-03-commerce.md).

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Plugin config | `apps/web/src/payload/commerce/plugin.ts` | `@payloadcms/plugin-ecommerce` 3.90.2; GBP, EUR, USD; addresses off; staff-only access |
| Fields | `apps/web/src/payload/commerce/fields.ts` | product title, slug, images; `requiresShipping`; order `shipping` and `needsReview`; tenant `shop` group |
| Adapter | `apps/web/src/payload/commerce/stripe-checkout.ts` | `stripe-checkout` payment method; `confirmOrder` verifies the session, then calls `finalizeOrder` |
| Constants | `apps/web/src/lib/commerce/config.ts` | webhook secret env name, expiry, tax behavior, limits, handled events |
| Checkout | `apps/web/src/lib/commerce/checkout.ts` | `startCheckout`: reads cart, prices, and stock on the server; creates the transaction and the Checkout Session |
| Settlement | `apps/web/src/lib/commerce/fulfill.ts` | orders, closing sessions, refunds, audit events |
| Webhook | `apps/web/src/lib/commerce/webhook.ts` | `POST /api/payments/stripe-checkout/webhooks` |
| Stripe client | `apps/web/src/lib/commerce/stripe.ts` | one client from `STRIPE_SECRET_KEY`; the single place Connect would hook in |
| Customers | `apps/web/src/payload/collections/Customers.ts` | link to a Better Auth user; admin-only; no Payload login |

## How it works

```
cart (secret, tenant, currency)
  -> startCheckout (server): check secret, tenant, published products, price in the site's currency, stock
  -> transaction (pending) + Stripe Checkout Session (metadata: flow=shop, tenantId, transactionId, cartId)
  -> buyer pays on Stripe's hosted page
  -> Stripe -> /api/payments/stripe-checkout/webhooks (signature checked with SHOP_STRIPE_WEBHOOK_SECRET)
  -> fulfillCheckoutSession -> plugin confirm-order (in process) -> adapter confirmOrder
  -> finalizeOrder: one order, stock down, cart marked purchased, transaction succeeded
  -> audit event order.created
```

- Prices come from products and variants at checkout time, never from the cart's stored subtotal or the browser. Missing price in the tenant's currency, unpublished product, wrong tenant, or short stock refuses with a `CartError`.
- `confirmOrder` re-reads the session from Stripe and refuses unless it's complete and paid (or `no_payment_required`), matches its transaction, and matches the transaction's currency and pre-tax subtotal.
- Events: `checkout.session.completed` and `async_payment_succeeded` fulfill (an unpaid session, as with delayed payment methods, waits for the async event); `async_payment_failed` and `expired` close a pending transaction; `charge.refunded` marks the transaction and order `refunded` on a full refund and records `order.refunded`. Other events are acknowledged.
- A thrown error answers 500 so Stripe retries. Replays and concurrent deliveries give one order.
- Stock isn't reserved. If an item sold out between checkout and payment, the order is still created and `needsReview` is set.
- Sessions carry `flow=shop` in metadata. The Better Auth billing webhook acknowledges payment-mode sessions without acting (docs/knowledge/payments.md); the shop ignores sessions without the flag.

## Per-tenant setup in /admin

- Tenants -> the tenant -> Shop: currency (GBP, EUR, USD), ships-to countries, and up to 5 flat shipping rates (label, amount in pence or cents). No rates means free shipping. Digital products (`requiresShipping` off) skip address and shipping collection.
- Products: title, slug (unique per tenant), description, images from that tenant's media, one price field per enabled currency (the tenant's currency must be priced), inventory.
- Tax: GBP and EUR prices include tax; USD prices exclude it. Stripe Tax is applied only when the Stripe account has registrations.
- Adaptive Pricing shows visitors abroad a local price; the charged amount and the order stay in the tenant's currency.

## Environment

- `STRIPE_SECRET_KEY` (shared with org billing) and `SHOP_STRIPE_WEBHOOK_SECRET`. Without the webhook secret the endpoint answers 503 and no order is created.
- Locally: `stripe listen --forward-to localhost:3000/api/payments/stripe-checkout/webhooks` prints the secret for `apps/web/.env.local`. Run it next to the billing listener from docs/knowledge/payments.md; each prints its own secret.

## Verify locally

```bash
pnpm db:up && pnpm db:migrate
pnpm --filter web verify:commerce
```

It runs the real Payload and database with a stand-in Stripe client (no network): checkout, paid session, one order, replay, concurrent settlement, refund, erasure. Unit tests: `pnpm test`.

## Test-mode end to end

There is no storefront yet, so drive it from a script or the Local API:

1. Start `pnpm dev` and the `stripe listen` command above; put its secret in `SHOP_STRIPE_WEBHOOK_SECRET`.
2. In /admin, set the tenant's Shop settings and create a published product with a price and inventory.
3. Create a cart for the tenant and call `startCheckout` (see `apps/web/src/scripts/verify-commerce.ts` for the calls) with a sandbox `STRIPE_SECRET_KEY`.
4. Open the returned URL and pay with `4242 4242 4242 4242`.
5. Check the forwarded event, then Orders in /admin: one order, `processing`, shipping copied from Stripe.

## Going live

1. Dashboard -> Webhooks: endpoint `https://<domain>/api/payments/stripe-checkout/webhooks` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Use the API version the `stripe` SDK pins (see payments.md). Set its secret as `SHOP_STRIPE_WEBHOOK_SECRET`.
2. Keep the billing endpoint from payments.md; it has a separate secret.
3. Dashboard -> Tax: head-office address and registrations (UK VAT, EU OSS, US states). Without registrations, checkout runs untaxed and the log says so.
4. Develop and run CI against Stripe sandboxes (one each); production uses the client's live account.
5. Use a restricted key where possible. It must create and read Checkout Sessions and read Tax settings and registrations; without tax read, checkout still works untaxed. Then run a live-mode purchase and a refund.
6. Per tenant: currency, ships-to list, shipping rates, product prices.

## Known issues

- The ecommerce plugin is beta with open checkout bugs. Variant checks in its endpoints don't run (payloadcms#18339), so our checkout re-validates everything. Pin it with Payload and re-run `verify:commerce` on upgrades.
- When two events settle one session at once, the plugin logs an error for the losing confirmation. Harmless: the loser finds the order and returns it.
- Refunds made through the Dashboard are recorded only when full; partial refunds are not reflected.

## Privacy

Account deletion and export are in docs/knowledge/compliance.md.
