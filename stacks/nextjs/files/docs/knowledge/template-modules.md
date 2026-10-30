<!-- last-verified: 2026-10-02 -->
# Template modules

What the template builds in (beyond the services in the cost model), which site types use which modules, and the agent-ready defaults. Read when scoping a new site or adding a module.

## Commerce, billing, and tenancy (built in)

| Module | Approach | Core or optional |
| --- | --- | --- |
| Promotions and coupons | Rules in Payload; subscription coupons mirrored to Stripe promotion codes | Core |
| Abandoned cart | Payload Jobs + SES (~$28/month at 280k emails) | Core |
| Returns | Payload collection + Shippo return labels | Core |
| Receipts and invoices | react-pdf UK VAT receipts in R2. Avoid Stripe post-payment invoices (0.4%, ~$12k/month here) | Core |
| Reviews, wishlists | Payload collections; reviews moderated with omni-moderation | Core |
| Recommendations | pgvector embeddings + co-purchase SQL | Core |
| Per-currency prices | Manual GBP/EUR/USD prices + Stripe Adaptive Pricing (needs Checkout Sessions) | Core |
| Gift cards, store credit | Postgres ledger | Optional |
| Multi-warehouse, B2B price lists | Stock per location; price lists keyed to the org | Optional |
| Marketplace | Stripe Connect with Stripe-handled pricing (£0 to platform) | Optional |
| Entitlements | Better Auth Stripe plugin `limits` + server `can()` helper cached in Upstash | Core |
| Metered AI and credits | Stripe Meters (included) + Postgres credit ledger for real-time blocking | Core |
| Tenant theming | Tokens in Payload, injected as CSS variables | Core |
| Tenant email domains | One SES identity per tenant + SES Tenants (~$4/month) | Core |
| Roles and permissions | Better Auth org access control + Payload access functions | Core |
| Audit log | Append-only partitioned `audit_events`, archived to R2 | Core |
| GDPR export and deletion | Payload job; deletion cascades to Stripe, SES, PostHog | Core |
| Tenant API keys | `@better-auth/api-key` + Upstash rate limits | Core |
| Outbound webhooks | Svix Basic (~$55) or self-hosted Svix | Optional |
| SSO and SCIM | Better Auth `sso` and `scim` (free; SCIM rewritten in 1.7, interop bugs open); WorkOS only on request | Optional |

## Agentic commerce

- Default path: Stripe Agentic Commerce Suite (GB supported, ~0.5% per agent transaction, third-party source).
- Expose: catalog feed pushed from Payload every 15 minutes, `/.well-known/ucp` with idempotent checkout-session endpoints, HMAC-signed order webhooks, catalog/cart MCP tools, Shared Payment Token acceptance.
- Google UCP checkout reaches the UK by end of 2026; Visa and Mastercard agent payments need nothing beyond Stripe.

## Gamification (built in, ~$110/month)

- Postgres append-only `points_ledger` is the source of truth; Upstash sorted sets cache leaderboards (Fixed 1 GB plan, $20; pay-as-you-go would be ~$600).
- Badges and quests are Payload collections. Rewards: AI credits, store credit, coupons.
- Anti-cheat: idempotency keys, per-event caps, rate limits, BotID on scoring routes.
- Streak reminders by SES and web push. Trophy would cost $3.9k–7.6k at this MAU.

## Agent-ready defaults

Built in the base: 1–4 (robots allow all crawlers), 5 (BotID Basic), 9 (AI referrals). 6–7 are per-client additions; 8 comes with commerce. Details: docs/knowledge/agent-ready.md.

1. JSON-LD per collection (Organization, Product, Article, FAQ, Breadcrumb, Event, Course).
2. Generated `sitemap.xml`, `llms.txt`, `llms-full.txt` (low impact so far, cheap to ship).
3. Markdown on `Accept: text/markdown`, rewritten in `proxy.ts` to a route built from Payload content.
4. robots policy per tenant: allow answer bots, choose for training bots.
5. BotID Basic everywhere; Deep Analysis on signup, checkout, and AI routes.
6. Public read-only MCP (`mcp-handler`) and admin MCP (`@payloadcms/plugin-mcp`).
7. OAuth for agents via `@better-auth/mcp` + `@better-auth/cimd` + `jwt()` (oidcProvider was removed in Better Auth 1.7).
8. Product feed ready for agentic checkout; checkout behind a flag.
9. AI referrer and bot traffic tracked in PostHog. Optional AI-search visibility tracking (Otterly ~$189).

## Other platform modules

- i18n: Payload field localization + next-intl; AI translation ~$6 per 2M words.
- Realtime: SSE + Upstash pub/sub; Liveblocks only for collaborative editing.
- Status page: OpenStatus. Feedback board: Fider (self-hosted).
- Backups: provider PITR + nightly `pg_dump` to R2, R2 copied to a second provider.
- Accessibility: `@axe-core/playwright` in CI. Mobile: Expo on the same APIs (later).

## Site archetypes

Modules: C CMS · A auth/orgs · $ Stripe · E ecommerce · V vector search · G agents · Gm gamification · R realtime.

| Archetype | Modules | Extra | Trend |
| --- | --- | --- | --- |
| Marketing site, blog | C, V | none | Shrinking (zero-click search) |
| Docs, knowledge base | C, V, G | MCP and Markdown matter most | Fewer visits, more agent reads |
| Ecommerce | C, A, $, E, V, Gm | Agentic commerce feed | Steady, agentic rising |
| Membership, paywall | C, A, $, Gm | none | Growing |
| Courses (LMS) | C, A, $, Gm, G | Bunny Stream | Growing |
| SaaS dashboard | A, $, G, R | none | Growing |
| AI agent product | A, $, G, R, Gm | AI Gateway usage | Fastest growing |
| B2B portal | A, C, $ | SSO | Growing |
| Marketplace | A, $, E, V | Stripe Connect | Growing |
| Booking | A, $, C | Cal.com (self-hosted) | Growing |
| Directory, listings | C, V, $, Gm | none | Shrinking |
| Community, forum | A, C, R, Gm | Built in (Discourse optional) | Growing |
| Events, ticketing | A, $, E, R | QR check-in | Steady |
| Local business, agency | C, $ | Booking optional | Steady |
| Internal tools | A, G, R | none | Growing |

## Related

- Costs: `docs/knowledge/cost-model.md` · ADR: `docs/adr/0001-stack.md`
