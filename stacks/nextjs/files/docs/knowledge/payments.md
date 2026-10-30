<!-- last-verified: 2026-10-03 -->
# Payments

How organizations subscribe: the Better Auth Stripe plugin, plans by lookup key, Stripe Tax, direct debits, and plan limits. Read before changing plans, prices, checkout, or anything that checks what a plan allows.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Plugin | `packages/auth/src/auth.ts` | `@better-auth/stripe` 1.7.7 + `stripe` 22 (the plugin's peer range). Added only when both Stripe env vars are set |
| Plans, limits, env names | `packages/auth/src/config.ts` | `PLANS` (lookup keys, seats), `FREE_LIMITS`, `ENTITLED_STATUSES` |
| Rules | `packages/auth/src/billing.ts` | who may change billing, checkout params, `getOrganizationPlan`, `can()`, seats, cancellation on delete |
| Prices | `pnpm --filter @__NAME__/auth stripe:seed` | creates products and multi-currency prices (GBP base, EUR and USD options), tax-exclusive. Idempotent |
| Page | `apps/web/src/app/(frontend)/account/billing/page.tsx` | status, seats, plan picker, Manage billing (Stripe portal) |
| Webhook | `POST /api/auth/stripe/webhook` | the plugin verifies the signature on the raw body; exempt from the per-IP auth limit |
| Shop webhook | `POST /api/payments/stripe-checkout/webhooks` | the shop's own endpoint and secret (`SHOP_STRIPE_WEBHOOK_SECRET`); docs/knowledge/commerce.md |

## Rules

- Organizations pay, never users (`createCustomerOnSignUp: false`, `customerType: "organization"`, `referenceId` = organization id).
- Owners manage billing; admins read it; members don't see it (`billing` statements in `access.ts`).
- No subscription means the free tier: free resources stay open and `FREE_LIMITS` apply. No trials.
- Only `active` and `trialing` unlock a plan. Bacs and SEPA debits sit in `incomplete` for about three working days; the page says so.
- Seats: members plus open invitations, checked on invite, accept, and add. Two invitations sent at the same instant can both pass; the invite rate limit bounds it. The organization plugin's `membershipLimit` follows the plan too.
- One live subscription per organization. While one exists (clearing debit, failed renewal, or paid), a plan change must name it (`subscriptionId`); `authorizeReference` refuses a second checkout, and the page hides plan buttons until the payment settles.
- Every billing call names the organization (`customerType: "organization"` plus `referenceId`); calls without one are refused, so no user is ever billed personally.
- Read limits with `getOrganizationPlan()` / `can()` on the server; never trust the client.
- An organization with a paid or failing plan can't be deleted: the plugin refuses until the plan is cancelled (the error says so). Deleting a user's sole-owned organizations, and organizations whose checkout never completed, cancels any live subscription; API keys are removed first so a Stripe failure can't leave them working. Stripe keeps customers and invoices for tax records.

- The shop shares this Stripe account and gets the same `checkout.session.*` events. A `before` hook in `auth.ts` (`isShopSessionEvent`) acknowledges payment-mode sessions without running the plugin, which would otherwise log an error for a session with no subscription. It reads an unverified clone of the body and does nothing with it. Subscription sessions are untouched.

## Stripe setup per project

1. Vercel: `vercel integration add stripe` (sandbox; claim it to the client's Stripe account before launch). Set `STRIPE_WEBHOOK_SECRET` from the webhook endpoint below.
2. Run `stripe:seed` with the sandbox key; set real amounts first (they're placeholders in the script).
3. Dashboard → Tax: head-office address, UK VAT registration, any EU OSS registration. Stripe Tax needs them before `automatic_tax` works.
4. Dashboard → Payment methods: turn on Bacs Direct Debit (GBP) and SEPA Direct Debit (EUR). Checkout shows what's on for the price's currency.
5. Dashboard → Webhooks: endpoint `https://<domain>/api/auth/stripe/webhook` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. One endpoint and secret per environment. Create the endpoint on the API version the `stripe` SDK pins (2026-08-26.dahlia for 22.6): the plugin reads `items.data[].current_period_*`, which older versions don't send, and its handlers swallow the resulting errors with a 200, so Stripe never retries.
6. Dashboard → Customer portal: allow cancelling, switching plans, and updating payment methods.

## Local development

- `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook` prints the webhook secret for `apps/web/.env.local`.
- Shown prices follow Vercel's `x-vercel-ip-country` header; locally there is none, so they show in USD. Checkout picks the charged currency itself.

## Gotchas

- Changing plugins: regenerate the auth schema, then re-apply the hand edits listed in its header (timestamptz, indexes).
- `stripe` 23 is outside the plugin's peer range; stay on 22 until the plugin moves.
- The Stripe plugin must stay after every unconditional plugin in `auth.ts`: a conditional entry mid-list widens the plugin tuple and drops other plugins' inferred fields.
