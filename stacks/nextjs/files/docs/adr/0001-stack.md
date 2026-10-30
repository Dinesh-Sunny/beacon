# 0001. Backend, data, and services stack

- Status: Proposed
- Date: 2026-10-02

## Context

AGENTS.md left backend, database, auth, and hosting as TBD. The template must serve 100,000 daily active users for a UK-registered business selling worldwide, and cover CMS, ecommerce, subscriptions, AI, video, and multi-tenancy at low cost per user. Next.js on Vercel is fixed.

Options compared: Supabase (DB + Auth + Storage), a full Cloudflare stack (Workers via OpenNext, D1, KV, Hyperdrive, R2), and Vercel plus best-value managed services. We also surveyed 16 current starters and open-source apps. Pricing, sizing, and the usage model are in `docs/knowledge/cost-model.md`.

## Decision

- Hosting: Vercel Pro with Flat Rate CDN. Keep Cache Components and the Python sidecar.
- CMS: Payload 3 (pinned 3.90.2) inside `apps/web`, tables in a `payload` Postgres schema, migrations only (no dev push), admin under Cache Components. Multi-tenant and ecommerce plugins come in later phases; commerce engine options in `docs/knowledge/commerce-options.md`.
- Database: plain Postgres 18 via Drizzle and `pg` (psycopg 3 in Python). Production on PlanetScale Postgres HA; dev and preview branches on Neon; local and CI on Docker. Two URLs per environment: pooled for the app, direct for migrations. Vectors use HNSW only (no pgvectorscale: Neon lacks it). Details: `docs/knowledge/database.md`.
- Auth: Better Auth 1.7 (`@__NAME__/auth`, tables in an `auth` Postgres schema) with organizations, API keys, two-factor, and EdDSA service tokens for the sidecar; Payload native auth for CMS editors. Details: `docs/knowledge/auth.md`.
- Images: Cloudflare R2 through `@payloadcms/storage-s3`, served from a Cloudflare custom domain.
- Video: Bunny Stream, referenced from a Payload collection; Mux as the higher-DX alternative.
- Jobs: Payload Jobs Queue run by Vercel Cron for light work; Vercel Workflow for durable agents.
- Payments: Stripe UK with multi-currency settlement, Stripe Tax, and Bacs/SEPA debits for subscriptions. Merchant of record stays optional.
- AI: LangChain Deep Agents (LangGraph) in `python/api`, models through Vercel AI Gateway. CopilotKit in `apps/web` over AG-UI. Jev routes requests; Langfuse traces; agent state in Postgres.
- Marketing: open source first. Listmonk on SES, self-hosted Umami and Postiz on one Hetzner box, Flags SDK with flags in Payload, support and content handled by our agents, referrals and reviews built in. c15t consent, self-hosted on our Postgres (`docs/knowledge/consent.md`).
- Analytics and ads: GA4 free tier and pixels only after consent, no GTM, server-side conversions from a shared `@__NAME__/conversions` package (planned), attribution stored in Postgres, product feeds via Google Merchant API.
- Built-in modules: promotions, receipts, returns, entitlements, AI credits ledger, tenant theming and email domains, RBAC, audit log, GDPR export, gamification, and agent-ready defaults (MCP, agent OAuth, Markdown pages, agentic commerce endpoints). See `docs/knowledge/template-modules.md`.
- Email: Amazon SES with React Email, one mailer for app and Payload emails (`docs/knowledge/email.md`). Errors: Sentry. Logs: Axiom via a Vercel log drain. Analytics: PostHog custom events, consent-gated (`docs/knowledge/observability.md`).

## Consequences

- At 100k DAU: platform ~$1,480/month, AI ~$17.9k (agents + tools), marketing ~$900, everything else ~$1k. Total ~$21k/month expected ($10k–33k), plus payment fees (~4.2% of revenue).
- Self-hosting marketing tools costs ~4–8 hours/month of upkeep.
- The Python sidecar becomes the AI backend, not only a helper for Python-only libraries. Heavy parsing (Docling) runs on a separate worker.
- Two database providers: Neon for branching, PlanetScale for production HA. Plain Postgres keeps both swappable. Small projects can stay on Neon or a single-node PlanetScale PS-5/PS-10 ($5–13).
- Self-hosted marketing tools use a local Postgres 17 on the Hetzner box, not the app database.
- Rejected Vercel AI SDK agents in favour of the Python ecosystem; LangSmith Deployment and full-volume LangSmith tracing on cost.
- Rejected Supabase Auth and Clerk (per-MAU pricing), Neon for production at this size (no standby, higher cost), Mux and Cloudflare Stream as defaults (~9× Bunny), and full Cloudflare (OpenNext Cache Components bugs).
- We own auth code. WorkOS AuthKit is the fallback.
- Payload's ecommerce plugin is beta; pin versions and build tax, shipping, and subscriptions around it.
- Revisit if Vercel spend passes ~$1,500/month from traffic, or when a tenant needs physical data isolation.
