<!-- last-verified: 2026-10-02 -->
# Commerce engine options

For whoever plans the commerce phase: Medusa v2 compared with Payload's ecommerce plugin, feature by feature, plus runtime, cost, and fit with our stack. Shopify is covered in `docs/knowledge/payload.md`. Sources: Medusa docs and source (2.21.2), Medusa Cloud pricing, Payload plugin source (v3.90.2).

## Feature comparison

B built in · P official plugin · R recipe (we build it) · N none.

| Area | Medusa 2.21 | Payload plugin 3.90 (beta) |
| --- | --- | --- |
| Products, variants, options | B | Yes |
| Categories, collections, tags, types | B | Partial (categories only in template) |
| CSV import/export | B | Partial (`plugin-import-export`) |
| Digital products | R | N |
| Multi-currency | B | Yes (one price field per currency) |
| Regions, price lists, customer-group and tiered prices, tax-inclusive | B | N |
| Multi-location stock, reservations, backorders, kits | B | N (stock drops at confirm; can oversell) |
| Guest carts, cart merge | B, partial merge | Yes, better merge |
| Checkout flow, cart locking, multi-shipping | B | Partial |
| Stripe | PaymentIntents only | PaymentIntents only |
| Manual and partial capture, refunds, saved cards | B | N |
| Tax regions and rates | B (manual rates; Avalara recipe; no Stripe Tax) | N |
| Shipping options, calculated rates, fulfillment, tracking | B (manual provider; ShipStation recipe) | N |
| Order edits, draft orders, returns, exchanges, claims | B | N |
| Promotions: codes, automatic, buy X get Y, budgets, free shipping | B | N |
| Customer groups | B | N |
| B2B companies, quotes, approvals | `b2b-starter` | N |
| Gift cards, store credit | P (loyalty plugin, MIT) | N |
| Subscriptions, marketplace, bundles | R | N |
| Sales channels, publishable keys | B | N |
| Multi-tenancy | Not native (docs say so) | P (`plugin-multi-tenant`) |
| Commerce admin UI | B (full) | Partial (Payload collection screens) |
| Admin RBAC, admin SSO | **Enterprise licence (paid)** | MIT code-based access; SSO via custom strategy |
| Workflows, events, scheduled jobs, locking | B | Partial (hooks, jobs queue) |
| Search, analytics, notifications, storage | B (Postgres search, PostHog, SendGrid, S3) | P search; email and storage adapters |
| Translations | B (feature flag) | Yes (core localization) |
| Next.js storefront | dtc-starter: Next 15.5, Tailwind 3, no Cache Components | Template on Next 16.3 |
| Agentic commerce | ACP tutorial; MCP Cloud-only, read-only; no UCP or ACS | Admin MCP plugin; none for ACP/UCP |
| Maturity | 36.5k stars, 208k weekly downloads, minors every 2–4 weeks with breaking changes | Beta, 9.5k weekly downloads |

## Runtime and cost

- Medusa can't run on Vercel Functions: it needs a long-running server and worker (2 GB RAM each) plus Redis (event bus, workflows, cache, sessions). Upstash per-request pricing suits BullMQ badly; use fixed-price Redis.
- Medusa Cloud: Develop $29, Launch $99 (Redis, backups), Scale $299 (dedicated worker), no GMV fee. Self-host on Railway or Render ~$30–60/month small, ~$200–400 at 60k orders (estimates).
- Admin is React 18 + Vite 7, so it needs its own app and pnpm hoisting rules. Separate database recommended (schema sharing is undocumented).
- Customers log in through Medusa's auth module; Better Auth needs a custom provider bridge.
- 500 tenants: no tenant isolation, single Stripe key per instance; instance-per-tenant ≈ $15–50k/month.

## What either engine still leaves to us

- Stripe Checkout Sessions adapter (Adaptive Pricing, Stripe Tax): needed for both.
- Subscriptions and entitlements (Better Auth Stripe plugin), UCP and Stripe ACS endpoints, outbound webhooks, address validation.
- With the Payload plugin we also build: fulfillment, returns, refunds, promotions beyond Stripe codes, gift cards, reservations, price lists.

## Recommendation

| Project | Engine |
| --- | --- |
| Digital, subscription, or AI-credit products; multi-tenant platforms; small shops on Vercel only | Payload plugin + our Stripe Checkout adapter (default) |
| Single-tenant physical-goods store needing returns, exchanges, multi-warehouse, promotions, B2B | Medusa adapter (Cloud Launch/Scale or Railway) |
| Client already on Shopify, or wanting zero commerce ops | Shopify adapter |

All three sit behind one `@__NAME__/commerce` interface (catalog, cart, checkout, orders, inventory) with per-adapter capability flags. Budget an Enterprise licence if a Medusa client needs admin roles or SSO.
