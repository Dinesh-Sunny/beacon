# 0003. Commerce

- Status: Accepted
- Date: 2026-10-03

## Context

Forks that sell things need products, carts, orders, tax, shipping, and refunds, per tenant, without a second backend. The choice was between Payload's ecommerce plugin, Medusa, Shopify, Stripe Payment Links, and custom tables (docs/knowledge/commerce-options.md). The shop shares one Stripe account with organization billing (docs/knowledge/payments.md), and shoppers sign in with Better Auth, never Payload.

## Decision

- `@payloadcms/plugin-ecommerce` 3.90.2 (beta, exact-pinned with Payload) provides products, variants, carts, orders, and transactions. The multi-tenant plugin runs last and scopes them per tenant. The addresses collection is off: Stripe Checkout collects them.
- Payment goes through our own `PaymentAdapter`, `stripe-checkout`, on hosted Stripe Checkout Sessions: mode `payment`, `price_data` from server-side prices, `automatic_tax` only when Stripe Tax has registrations, Adaptive Pricing, promotion codes, 30-minute expiry, and an `integration_identifier`. The plugin's own adapter (Payment Element, PaymentIntents) is rejected: it has no Adaptive Pricing or Stripe Tax.
- Checkout starts from our server code; the adapter's `initiatePayment` returns 501. `finalizeOrder` is reachable only inside the plugin's confirm-order endpoint, which the webhook invokes in-process.
- One Stripe account per deployment, as for org billing. Stripe Connect later only adds `stripeAccount` to the calls in `lib/commerce/stripe.ts`.
- Shipping is up to 5 flat rates per tenant, offered in Checkout, plus a ships-to country list per tenant. Currency is per tenant: GBP (default), EUR, or USD. Prices include tax for GBP and EUR, exclude it for USD.
- The shop has its own webhook, `/api/payments/stripe-checkout/webhooks`, and secret, `SHOP_STRIPE_WEBHOOK_SECRET`. The Better Auth billing webhook acknowledges payment-mode checkout sessions and leaves them to the shop.
- Orders are created on `checkout.session.completed` and `checkout.session.async_payment_succeeded`, gated on `payment_status`. `async_payment_failed` and `expired` close the transaction; `charge.refunded` marks full refunds. Replays and concurrent deliveries yield one order.
- A `customers` collection links Better Auth users (`betterAuthUserId`). Guest orders are allowed; the storefront PR shows them read-only by verified email.
- Account deletion pseudonymizes orders and transactions (kept for UK VAT records, 6 years; the country stays), and deletes the customer and open carts. Data export includes orders. Audit events `order.created` and `order.refunded` fall under category `commerce`.

## Alternatives considered

- Stripe Payment Links, Shopify, Medusa, or custom tables: see docs/knowledge/commerce-options.md.

## Consequences

- The plugin is beta; upgrades need the verify script and a read of its changelog.
- Two Stripe webhooks to configure per environment, each with its own secret.
- Stock isn't reserved: an oversold paid order is kept and flagged `needsReview`.
- The storefront UI (shop, cart, checkout success, order history) is a follow-up PR; this one is backend only.
- Built in two steps: backend, then storefront (docs/plans/2026-10-03-commerce.md).
