<!-- last-verified: 2026-10-03 -->
# Stack fit review

Whether what's built and what's planned (ADR 0001, template-modules.md) fit together, checked against current versions and vendor docs on 2026-10-03. Read before starting a phase or upgrading a core package; re-run when a major dependency ships.

## Verdict

Nothing built today is outdated, and every planned piece fits. The two build problems found (pnpm 12, Python workspace install) are fixed in `vercel.json`; deploying now needs only Vercel Pro. The rest are caveats to handle in the phase that adds the piece.

## Blockers

| Item | Problem | Action |
| --- | --- | --- |
| ~~pnpm 12 on Vercel~~ (fixed) | Vercel builds support pnpm 6–10 and fall back to npm (vercel/vercel#17434) | `web` installs and builds through `npx --yes corepack pnpm …`, which reads the version from `packageManager`. Proven with `vercel build` |
| ~~Python service bundled no dependencies~~ (fixed) | With the uv workspace lock at the repo root, Vercel's builder runs `uv sync` there and installs only the empty root project | `api` sets `entrypoint` (the app isn't at `main.py`) and `installCommand: uv sync --active --package __NAME__-api --frozen --no-dev --no-editable`. Proven: FastAPI, psycopg, `__PYNAME___core` bundled and the app imports |
| Hobby plan | Non-commercial only (client work counts); crons max once a day (every-minute cron fails the deploy); no log drains | Pro before any client deploy. Deploys stay paused until then |

## Before the phase that needs it

**Consent and ads (conversions phase)**
- Only the measurement choice reaches the server (`__PYNAME___analytics_consent`). Ads need a separate marketing mirror, and `consent.md`'s "marketing or measurement" must become marketing-only for ad platforms.
- Webhooks (Stripe, Better Auth) have no cookies: snapshot consent and click ids (`gclid`, `fbc`, `fbp`) into Postgres at signup or checkout, purge on withdrawal.
- Google: build on the Data Manager API (the Ads API rejects new conversion-upload integrations since 15 Jun 2026); Merchant API only (Content API sunset 18 Aug 2026).
- Ad pixels (c15t ships Meta, TikTok, LinkedIn helpers) go under `marketing`, and `TRACKER_COOKIE` grows to clear their cookies.
- Agentic commerce: ChatGPT Instant Checkout shut down (Mar 2026); Stripe's Agentic Commerce Suite is private preview, region-limited. Don't build on either yet.

**AI backend**
- Packages install on Python 3.14 (deepagents 0.7, langgraph 1.2, langchain 1.4); pin exact (pre-1.0 glue).
- LangGraph Postgres checkpointer works through our pooler only with our pool settings (`prepare_threshold=None`); never `from_conn_string`. Test pipeline mode on Neon and PlanetScale poolers.
- No `prune()` in the open-source saver: checkpoint pruning is our own SQL (naive "keep latest" can lose state).
- One durability layer: LangGraph checkpoints own agent state; Vercel Workflow or Queues only drive resumes for runs over the function limit (300 s Hobby, 800 s Pro).
- CopilotKit 1.77 fits React 19.2/Next 16 with the sidecar private; auth forwarding (session → EdDSA service token) needs a spike; disable its telemetry deps. AI SDK UI is the native choice only if agents move to TypeScript.
- Langfuse SDK is v4 (OpenTelemetry), not v3; measure units per run before trusting the cost model.
- Docling: CPU-only torch and baked models; run on a container worker, not a function.

**Payload 4.0 (canary only today; needs Node 24.15, Next ≥16.2.6, TypeScript 6)**
- Jobs move to lease claims: our stuck-job release in `jobs-cleanup` becomes unnecessary and must be removed.
- Storage adapters move under a `storage` key; `alwaysInsertFields` goes.
- `overrideAccess` defaults to false, depth to 1.
- Ecommerce adapters must call `finalizeOrder`: it already exists in 3.90.2 and our `stripe-checkout` adapter uses it, so the 4.0 contract needs no rewrite.

**Commerce and tenancy**
- Built (docs/adr/0003-commerce.md): Payload ecommerce plugin (still beta, open checkout bugs) with our own Stripe Checkout adapter. Org billing and the shop use separate webhooks; shop checkout creates no Stripe customer, organizations own theirs.
- Multi-tenant plugin is stable; map each tenant to a Better Auth organization id. RLS only with `SET LOCAL` inside transactions (transaction-mode pooler), and only for our Drizzle tables.

## Holds

- `stripe` stays on 22: `@better-auth/stripe` 1.7.7 peers on ≤22 (23 shipped 1 Oct).
- Drizzle stays 0.45: Payload 3.90 and the 4.0 canary pin it; v1 is RC.
- Payload stays 3.90.2 (latest stable); open Cache Components issues include #15893 (duplicate autosave drafts on Vercel): check on the first real deploy.
- Vercel Services is beta: pin the CLI; `.next/server` is ~145 MB against the 250 MB function cap.

## Fits as planned

Next 16.3.8, React 19.2 (19.3 allowed), Better Auth 1.7.7 (SSO, SCIM, MCP, CIMD, OAuth provider are separate packages), Postgres 18 + pgvector 0.8.5 on both providers (PlanetScale also has pgvectorscale, pg_partman), c15t 2.3, Upstash, Sentry 11.x, PostHog, Flags SDK 4.3 (custom adapter for flags in Payload), SES + Listmonk 6.2, Umami 3.4, Postiz 2.x, R2 via `storage-s3`, AI Gateway from Python, Jev (pin the model, keep a fallback), mcp-handler 2 (MCP SDK v2, zod ≥4.2).

## Overlaps to decide

- Web analytics: Umami, GA4, and PostHog overlap. The UK Data (Use and Access) Act exempts first-party statistics cookies with opt-out, which favours cookieless Umami for basic traffic; keep GA4 only for ads, PostHog for product events.
