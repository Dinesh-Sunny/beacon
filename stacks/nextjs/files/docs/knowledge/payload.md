<!-- last-verified: 2026-10-02 -->
# Payload CMS: features and stack fit

For whoever plans or builds the CMS phase: what Payload offers today, how it fits our current and planned stack, and the decisions it forces. Sources: Payload docs (v3 llms-full), the payload repo (3.x branch and main), npm, and the linked issues.

## Version status

- Stable: `payload@3.90.2` (2026-09-23), MIT. Minors every 1–4 weeks. 3.90.0 shipped critical security fixes.
- Next major: 4.0 is in canary (`4.0.0-canary.37`); `main` is already 4.0. No GA date.
- 4.0 breaks: Local API `overrideAccess` defaults to `false`, default depth 1, versions everywhere, storage adapters under a `storage` key, jobs types renamed, Slate removed. Needs Node 24.15, Next 16.2.6, TypeScript 6.0.3. `npx @payloadcms/codemod` automates most of it.
- 4.0 adds a redesigned admin, core hierarchies (replacing plugin-nested-docs), better DAM and MCP, and lease-based job claims.
- Payload joined Figma (2025-06); it stays MIT and self-hostable.

## Features (3.x)

- Data: collections, globals, 22 field types (blocks, join, relationship and polymorphic upload, Lexical rich text, point, json, virtual fields).
- Logic: hooks at collection, global, and field level; access control at the same levels (RBAC is a pattern on top).
- Content workflow: versions, drafts, autosave, scheduled publish, live preview, localization, trash, document locking. Folders and list `groupBy` are beta.
- APIs: Local API, REST, GraphQL, custom endpoints. Built-in auth with API keys and custom strategies.
- Uploads with sharp (sizes, crops, focal point); jobs queue with tasks, workflows, and cron schedules.
- Admin: custom components and views, admin i18n, query presets, bulk edit. Dashboard widgets are experimental.
- Official plugins: seo, search, form-builder, redirects, nested-docs, multi-tenant, import-export, sentry, stripe, mcp. Ecommerce is **beta**.
- Adapters: Postgres, SQLite, MongoDB (db); S3, GCS, Azure, Vercel Blob (storage); Nodemailer, Resend (email).
- Templates worth copying from: `website`, `ecommerce`, and the `multi-tenant` example.

## Fit with the current stack

| Area | Status | What to do |
| --- | --- | --- |
| Next 16.3.8, React 19.2.8, Turbopack | Supported (peer `next >=16.3.3 <17`) | Pin every `@payloadcms/*` to the same exact version |
| Drizzle | Payload pins `drizzle-orm 0.45.2`, same as `@__NAME__/db` | Upgrade both together |
| `cacheComponents` | Partial: docs say "full compatibility is not guaranteed"; open #18065, #16270, #17545, #15893 | See decision 2 |
| `withPayload` | Works, but adds `Vary`/`Accept-CH` headers on every path (splits CDN cache) | Re-scope those headers to the admin route only |
| Root layout | Payload owns its own `<html>` | Move frontend routes into a `(frontend)` route group |
| Connection pool | Payload builds its own `pg.Pool` | Second pool per instance: cap `max` at 5 and attach it with `attachDatabasePool` |
| Schema | Dev `push` would offer to drop our Drizzle tables in `public` | `schemaName: 'payload'`, `push` only on local throwaway DBs |
| Migrations | `payload migrate` takes no lock | Extend our migrate script: lock, Drizzle, then Payload, unlock |
| pgvector | No vector field | Use Payload's `afterSchemaInit` hook with Drizzle `vector()` columns, or our own table |
| sharp | Optional, prebuilt binaries | Add to `apps/web`; `allowBuilds: false` is fine |
| Vercel | 4.5 MB body limit; migration JSON grows bundles (#15501) | S3/R2 `clientUploads`; exclude migration JSON from tracing |
| Tailwind 4 / shadcn | Workable; admin CSS lives in `@layer payload-default` | No preflight in admin; dark variant is `[data-theme=dark]` |
| Biome, pnpm | Fine; needs `graphql` peer | Ignore generated `importMap.js`, `payload-types.ts`, migrations |

## Fit with the planned stack

| Integration | Support | Recommendation |
| --- | --- | --- |
| Better Auth | Community only (`payload-auth`, single maintainer, open credential-logging issue #154) | Keep the split: Payload auth for editors, Better Auth for app users |
| Cloudflare R2 | Official via `storage-s3` | `region: 'auto'`, `forcePathStyle`, `clientUploads`, custom domain URLs |
| Bunny Stream | Community (`@seshuk/payload-storage-bunny`) | Or a small `videos` collection holding the Bunny GUID |
| Ecommerce | Official, beta; PaymentIntents only (no Adaptive Pricing); open stock/price validation bugs (#17866, #18339, #15784) | Use its data model, pinned; write our own Checkout Sessions payment adapter |
| Stripe | Official `plugin-stripe` (sync, webhooks) | Subscriptions via Better Auth's Stripe plugin, as planned |
| Multi-tenant | Official, stable | Domain → tenant lookup in `proxy.ts`; watch #14576 (tenant delete on Postgres) |
| Jobs | Core; never `autoRun` on serverless | Vercel Cron per queue, one runner per queue: 3.x claims can double-run (fixed only in 4.0, PR #17220, #17441) |
| MCP | Official `plugin-mcp` | Admin MCP; public MCP stays `mcp-handler` |
| Vector search | No plugin | `plugin-search` + our pgvector embeddings table, filled by a job |
| Email (SES) | No SES adapter | Custom adapter onto `@__NAME__/email` (SES v2); React Email templates (`docs/knowledge/email.md`) |
| i18n | Core field localization | next-intl owns routing; pass `locale` to Local API |
| SEO, redirects, forms | Official plugins | Revalidate with `revalidateTag(tag, 'max')` in hooks, not `updateTag` |
| Flags SDK | No adapter | Small custom adapter reading a Payload global |
| Sentry / PostHog | Official Sentry plugin / none | PostHog SDKs directly |

## Enterprise-only features (not in the MIT core)

13 paid packages, private (404 on public npm), unlocked by an Enterprise agreement; no public prices. Core runs fully without them.

| Paid feature | Our open-source replacement |
| --- | --- |
| Admin SSO (`plugin-oauth2`) | Better Auth `sso` plugin wired in as a Payload custom auth strategy |
| Audit logs | `audit_events` table written from `afterChange`/`afterDelete` hooks; core versions for diffs |
| Publishing workflows | Drafts + a `workflowStatus` field, field access, `beforeChange` guards, job notifications |
| Visual editor, Vercel Content Link | Core Live Preview + admin bar |
| A/B testing | Flags SDK with precomputed variants |
| AI embeddings, AI translate | pgvector + AI SDK via AI Gateway in hooks or jobs |
| Email builder | React Email + email adapter |
| Environments, admin-only, Figma | Separate deploys per environment; skip Figma |

Multi-tenant and code-based access control stay MIT. Payload Cloud has paused new deployments, so self-hosting on Vercel (our plan) is the only route.

## Ecommerce plugin gaps

The plugin is a data model (products, variants, carts, orders, transactions, per-currency prices), not a commerce engine. Missing: tax, shipping, promotions, returns and exchanges, fulfillment states, gift cards, multi-location stock and reservations, B2B price lists, order editing, subscriptions. Stock drops only at order confirm, so concurrent checkouts can oversell. The template has no tax, shipping, or discounts either.

Open bugs on the checkout path: #17866, #18339 (variant stock and price not checked), #15784 (amount fixed to subtotal), #16453 (payment retry fails), #18338 (variant hooks outside the transaction).

Compared with engines: Medusa v2 (MIT) covers almost every gap but needs a long-running server, worker, and Redis (Medusa Cloud $29–299/month); Saleor Cloud starts at $1,599/month; Vendure is GPLv3.

Plan, smallest first:
1. Own Stripe Checkout Sessions adapter (M): Stripe handles tax, Adaptive Pricing, shipping rates, promo codes; server re-checks stock and price.
2. Fulfillment states, refunds and returns, abandoned-transaction cleanup job (M).
3. Gift card and store credit ledger, agentic commerce endpoints (M).
4. Behind a `commerce` interface (catalog, cart, order, inventory), so shops needing multi-warehouse, exchanges, or B2B can swap in Medusa.

### Shopify as an optional commerce engine

- Cost at 60k orders/month (list prices, £2.4M GMV): Plus + Shopify Payments ~3.5% of GMV plus an unpublished platform fee, vs Stripe-direct ~4.0%. Advanced ~4.0%. Keeping Stripe on Shopify adds 0.2–2% per order.
- Covers most plugin gaps: tax (UK/EU), Markets currency and duties, carrier rates and labels, discounts, gift cards, multi-location stock, B2B, POS, agentic channels (ChatGPT, Gemini, Copilot; co-develops UCP with Google and Stripe).
- Limits: Shopify-hosted checkout is mandatory; checkout extensions, branding, and own login (Multipass closed to new stores) are Plus-only ($2,300–2,500/month); subscriptions are physical selling plans, not entitlements or AI credits; one store per tenant; API terms forbid reproducing Shopify. Vercel's Next.js Commerce template still targets Next 15.
- Fit: physical-goods shops, clients already on Shopify, or teams wanting zero commerce ops. Not for digital or subscription-led products, one shared login, or the 500-tenant platform.
- Cheap middle ground: the £0 Agentic plan lists a Payload + Stripe catalog in AI channels.
- Template shape: `@__NAME__/commerce` interfaces (catalog, cart, checkout returning a redirect URL, orders, inventory) with adapters declaring capabilities; `payload-stripe` default, `shopify` and `medusa` optional. Entitlements, credits, and Stripe Billing stay outside.

## How the template wires it (phase 2)

- Route groups: `apps/web/src/app/(payload)` (Payload's generated admin and API routes) and `apps/web/src/app/(frontend)` (the site). `apps/web/src/app/global-not-found.tsx` serves unmatched URLs for both; robots, sitemap, manifest, and `/api/health` stay at the app root.
- Config: `apps/web/src/payload.config.ts`; collections, access, hooks, and storage in `apps/web/src/payload/`; `getPayloadClient()` in `apps/web/src/lib/payload.ts`.
- Collections: `users` (staff only; first account becomes admin; roles admin/editor), `media` (sharp sizes, R2 when `S3_BUCKET` is set), `pages` (drafts, autosave, scheduled publish). Page hooks revalidate `pages` plus the live slug before and after each save, so unpublish and rename clear the right URL; autosaves skip it.
- Site content: `pages.layout` is a blocks field (hero, features, call to action, rich text, FAQ) defined once in `apps/web/src/payload/blocks/` and referenced by slug. The `navigation` global holds header and footer links. Every CMS link goes through `parseSiteHref` (`apps/web/src/lib/site-href.ts`): site paths, https, and mailto only, checked on save and again on render.
- Site rendering: `apps/web/src/lib/cms.ts` reads published content only (`draft: false`, `overrideAccess: false`) inside `use cache`, filtered by tenant, with per-tenant tags (`t:<tenant>:pages`, `t:<tenant>:page:<slug>`, `t:<tenant>:navigation`). The `(site)` route group renders `/` (slug `home`, or a noindex setup page until it exists), `/<slug>`, header, and footer. Add a block: config in `payload/blocks/`, renderer in `apps/web/src/components/site/blocks/`, a case in `RenderBlocks` (the switch is exhaustive), then `pnpm cms:migrate:create`.
- Site caching: publishing refreshes in the background (`revalidateTag(tag, "max")`); unpublish, rename away, delete, and deleted media expire at once (`{ expire: 0 }`), so taken-down content never reaches another visitor. Media changes refresh their tenant's pages (hero images are embedded at depth 1); moving a page, image, or navigation to another tenant also clears the old site. Slugs that match a code route (`RESERVED_SLUGS`, `apps/web/src/lib/reserved-slugs.ts`) fail validation.
- Known limit: an unknown or unpublished slug streams inside Suspense, so it answers 200 with `noindex` and the site's not-found page, not a 404 status (also true with a blocking render: measured on `next start`, the first request was 200). The home slug path redirects to the site root with a real 308 from `next.config.ts`.
- Tenancy (docs/adr/0002-multi-tenancy.md): `@payloadcms/plugin-multi-tenant` scopes pages, media, and navigation (one document per tenant) for staff; admins see every tenant, editors only those on their user. Anonymous reads aren't scoped by the plugin, so every public read in `apps/web/src/lib/cms.ts` takes a tenant id and filters by it, and cache tags carry it (`t:<id>:…`). The seeded `default` tenant owns all content in a single-tenant fork; page slugs are unique per tenant. Requests pick their tenant by host: `next.config.ts` rewrites the host into the internal `[site]` route segment (`apps/web/src/app/(frontend)/(site)/[site]/`), and `getSiteForParam` / `getSiteForRequest` (`apps/web/src/lib/tenant.ts`) resolve a listed domain, `<slug>.$TENANT_BASE_DOMAIN`, or else the default site. Unknown subdomains under the base domain and suspended tenants answer 404. Each site gets its own canonical origin (primary domain), name and description, sitemap, robots, llms.txt, and Markdown. Sign-in, account, and invitation pages on tenant domains redirect to the app host (`BETTER_AUTH_URL`); the consent API accepts listed tenant domains. The default site answers only on its own hosts (`SITE_URL`, the app's Better Auth hosts, localhost in development); any other unlisted host, an internal `/<host>/…` path, or an app prefix that falls through to the `[site]` segment is a 404, so forged Host headers can't create cached copies. Social cards come from the host-aware og route (`apps/web/src/app/og/`) (file-based `opengraph-image` under `[site]` would put the host in its URL twice). Known limits: the consent banner's wording and the icons name the base site; the web manifest is per site.
- Jobs: Vercel Cron calls `/api/payload-jobs/run?allQueues=true&limit=25&silent=true` every minute with `CRON_SECRET` (scheduled publish and our tasks, docs/knowledge/jobs.md). Runs only through that route, never the CLI, one cron for every queue.
- Every-minute crons need Vercel Pro; Hobby rejects the deployment. Until the project moves to Pro, `vercel.json` sets `git.deploymentEnabled: false`, so pushes and PRs don't deploy. Remove it when the team is on Pro and the environment variables are set.
- Database: `payload` schema, `push: false`, UUID ids, pool max 5 on the pooled URL (direct while `PAYLOAD_MIGRATING`). Migrations in `apps/web/src/migrations`, applied by `pnpm db:migrate`.
- `next.config.ts`: `withPayload`, then Payload's color-scheme client hints are re-scoped to `/admin/:path*` so public pages keep one CDN cache entry.
- Admin under Cache Components: the `(payload)` layout and admin page call `connection()` and set `instant = false`.
- Robots: the admin route (/admin) and `/api/` are disallowed in robots.txt and the admin sends `X-Robots-Tag: noindex`.
- Verified 2026-10-02 (dev and `next start`): first-user setup, login, draft autosave, publish, rename, unpublish, scheduled publish via the cron route, media upload with sizes, anonymous access limits, migrations twice in a row.

### Known issues

- Dev overlay still reports a prerender warning from Payload's root layout (#18065); production builds and runs cleanly.
- Since Next 16.4, an unknown admin URL (`/admin/<missing>`) also shows a dev-overlay "unstable value `new Date()`" error from Payload's `initReq` in the generated `not-found.tsx` (#18065). Adding `await connection()` there swaps it for "Missing <html> and <body>", so leave the generated file alone until Payload fixes it.
- React hydration warning #418 in the admin came from a browser extension injecting attributes (`bis_skin_checked`); check in a clean profile before chasing it.
- In dev, opening "Create new" can leave one extra empty draft (React Strict Mode double effect); not in production.
- A fresh deploy offers the first-user screen to anyone: create the first admin right after the first production deploy.
- Payload keeps one pool connection checked out per instance for reconnects, so its pool of 5 is effectively 4 plus 1 pinned.
- R2 client uploads need the checksum settings in storage.ts; not yet tested against a real bucket.
- Generated files (`importMap.js`, `payload-types.ts`, migrations, `(payload)` routes) are excluded from Biome; regenerate, don't hand-edit (the layout and admin page carry the documented Cache Components changes).

## Decisions this forces

1. **Version:** build on 3.90.2 (pinned) and write v4-ready code (explicit `overrideAccess`, no Slate, storage config isolated), then run the codemod when 4.0 is GA. Starting on the canary means TypeScript 6 and weekly breaking changes.
2. **Admin placement:** `cacheComponents` is app-wide. Either keep Payload inside `apps/web` and accept the open admin issues, or run the admin as its own app (a new cms app under apps/) with `cacheComponents` off, while `apps/web` reads content through the Local API or REST.
3. **Jobs:** single runner per queue until 4.0; long or durable work goes to Vercel Workflow.
4. **Payments:** the ecommerce plugin's Stripe adapter can't do Adaptive Pricing; budget a custom adapter.
