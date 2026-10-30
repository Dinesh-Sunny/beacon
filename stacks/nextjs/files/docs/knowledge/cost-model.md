<!-- last-verified: 2026-10-02 -->
# Cost model at 100k DAU

Monthly cost of the template's stack at 100,000 daily active users, for a UK-registered business selling worldwide. Read before choosing or changing a paid service, or when tuning caching, media, AI, or payments.

## Usage model

Every figure below is computed from these inputs. USD converted at £1 = $1.25.

| Input | Value |
| --- | --- |
| DAU / MAU | 100,000 / 250k–500k (MAU is unique users per month, not DAU × 30) |
| Page views | ~30M/month (1.5 sessions × 6 pages); peak hour 2.5× average |
| API / server actions | ~15M/month; cart and checkout ~4.2M/month |
| Customers | UK 30%, EEA 25%, US 30%, rest of world 15% |
| Orders | 60,000/month, AOV £40, GMV £2.4M |
| Subscriptions | 17,500 × £8 = £140k MRR |
| AI | 3M requests/month: 2.7M chat turns (1,500 in / 500 out) + 300k deep-agent runs (20k in / 3k out, ~45 s); 50% cacheable input |
| Marketing | 400k contacts (250k opted in), 1.5M marketing emails, 50k SMS/WhatsApp, 2M notifications |
| Images | 8 per page view, ~60 KB, ~10 TB and 240M requests/month after cache |
| Video | 20% of DAU × 4 min/day = 2.4M minutes, ~45 TB/month; library 12,000 min |
| Database | ~120M queries/month (80M–240M), peak ~250 QPS, working set 5–8 GB |
| Tenants / email | 500 tenants (200 custom domains) / 300,000 emails |

## Stack and monthly cost (USD)

| Area | Choice | Low | Expected | High |
| --- | --- | --- | --- | --- |
| Hosting | Vercel Pro, Flat Rate CDN $100–300 tier, 3 seats | 390 | 595 | 800 |
| Database (prod) | PlanetScale Postgres HA, PS-80 / PS-160 / PS-320 | 150 | 316 | 640 |
| Database (dev, previews) | Neon free tier, branch per preview | 0 | 0 | 0 |
| Auth | Better Auth on our schema; Payload native auth for editors | 0 | 0 | 0 |
| Images | R2 + Cloudflare custom domain, sizes made by sharp at upload | 2 | 15 | 27 |
| Video | Bunny Stream, Volume network (Standard for Asia latency) | 245 | 245 | 605 |
| Rate limits | Vercel Firewall + Upstash Redis | 10 | 20 | 30 |
| Jobs | Payload Jobs + Vercel Cron; Vercel Workflow for agents | 5 | 10 | 25 |
| Email | Amazon SES with React Email templates | 30 | 39 | 48 |
| Errors / logs | Sentry Team + Axiom free tier | 26 | 26 | 26 |
| Analytics | PostHog custom events (~3M) | 84 | 218 | 352 |
| **Platform** | | **~940** | **~1,480** | **~2,550** |
| AI agents | Deep Agents in `python/api`, models via AI Gateway, Langfuse | 7,240 | 14,900 | 21,670 |
| AI tools | Jev, web search, sandboxes, OCR, memory, rerank | 1,300 | 2,960 | 5,270 |
| Marketing | Open-source first, see marketing table | 460 | 900 | 1,950 |
| Analytics and ads | Code-owned tags and server-side conversions | 0 | 20 | 180 |
| Commerce, billing, tenancy | Built-in modules; Stripe agentic commerce 0.5% | 30 | 590 | 1,100 |
| Gamification, agent-ready, other | Built-in; BotID Deep, AI-search tracking | 60 | 395 | 600 |
| **Total before payment fees** | | **~10,030** | **~21,250** | **~33,320** |

Expected platform cost is about $0.015 per DAU per month; AI is ~$0.18 per DAU and ~$0.006 per AI request.

## AI stack (USD/month, expected)

Browser → CopilotKit (React) → `apps/web` `/api/copilotkit` (CopilotRuntime + `HttpAgent`, checks auth) → `BACKEND_INTERNAL_URL` → `python/api` (`ag-ui-langgraph` endpoint wrapping `create_deep_agent`) → models via AI Gateway's OpenAI-compatible endpoint.

| Piece | Choice | $/month |
| --- | --- | --- |
| Chat turns (2.7M) | Gemini 3.1 Flash-Lite | 2,592 |
| Deep runs (300k) | Claude Sonnet 5.5 orchestrator + Haiku 4.5 sub-agents | ~10,920 |
| Agent runtime | Vercel Python (Fluid), 800 s max on Pro | 50–200 |
| Agent state | LangGraph `AsyncPostgresSaver` + Store, pruned nightly | ~100 |
| Tracing / evals | Langfuse, 10% of chat turns + all deep runs | ~1,140 |
| Frontend | CopilotKit (MIT, self-hosted runtime; no Copilot Cloud) | 0 |
| Router / classifier | TypeSafe Jev (`jev-1.13.0`, $0.042/M input) | 76 |
| Web search | Exa (Firecrawl ~$949 as budget option) | 2,400 |
| Sandboxes | Vercel Sandbox (Daytona fallback) | ~150 |
| Document parsing | Mistral OCR 4.1; Docling on a separate worker | 80 |
| Memory | LangMem on Postgres + pgvector | 55 |
| Rerank | Voyage `rerank-2.5-lite` | 198 |
| Moderation | OpenAI `omni-moderation` | 0 |

Rejected: LangSmith Deployment (~$720+/month compute), LangSmith tracing at full volume (~$15k), Copilot Cloud (300k threads needs Enterprise), mem0 and Zep (retrieval caps).

## Marketing stack (USD/month, expected)

Order of preference: build into Payload/Next.js, then self-hosted open source, then SaaS.

| Area | Choice | $/month |
| --- | --- | --- |
| Marketing email | Listmonk (self-hosted) on SES à la carte | 150 |
| Web analytics | Umami, self-hosted, cookieless; PostHog stays for product | 0 |
| Flags / experiments | Flags SDK with a Payload adapter; analysis in PostHog | 0–35 |
| Support | CopilotKit + Deep Agents first line; tickets in Payload | 0 + LLM |
| Referrals, reviews, short links | Built in: Stripe promotion codes, Payload collections, `/go/[slug]` | 0 |
| Social | Postiz, self-hosted | 0 |
| SEO data | Search Console API + DataForSEO pay-as-you-go | 30 |
| Consent / ad conversions | c15t / server-side, gated on consent | 0 |
| Messaging | Email, web push, in-app first; WhatsApp utility; SMS only as OTP fallback | 508 |
| Marketing agents | Support, drafts, SEO pages, newsletters, copy variants | 150 |
| Self-host box | Hetzner CX43 or CAX31 with Coolify (Listmonk, Umami, Postiz) | 30 |

Dropped: Loops, Attio, Umami Cloud, PostHog flags, Ahrefs, Dub, Crisp, Senja, CRM (until B2B sales). Sign-in uses magic links, email OTP, and passkeys, not SMS.

## Analytics and ads (USD/month, expected ~20)

- GA4 free tier only, loaded through c15t after consent; PostHog stays the source of truth.
- No GTM (web or server-side). Tags are code-owned via `@c15t/scripts`.
- Server-side conversions to Meta, Google (Data Manager API), TikTok, LinkedIn, Microsoft, Reddit from a shared conversions package (planned, `@__NAME__/conversions`), triggered by Stripe and Better Auth hooks.
- Attribution: `proxy.ts` captures UTMs and click IDs into a first-party cookie after consent; first/last touch stored in Postgres; Google Meridian for quarterly MMM.
- Product feeds: Payload hook pushes to Google Merchant API (Content API sunset 2026-08-18); Meta catalog file written by cron to storage.
- Consent Mode v2 basic for UK/EEA by default.

## Payment fees (GBP, scale with revenue)

Stripe UK on £2.54M/month, with multi-currency settlement (EUR free, USD 1%) paid out to Wise:

| Item | £/month |
| --- | --- |
| Card fees (UK 1.5% + 20p, EEA 2.5% + 20p, intl 3.15% + 20p) | ~78,800 |
| Currency conversion (with multi-currency settlement) | ~17,650 |
| Stripe Billing (0.7%) | 980 |
| Stripe Tax Basic (0.5% where registered) | ~8,230 |
| Disputes (£20 each) | ~1,550 |
| **Total** | **~107,200 (4.2%)** |

- Converting everything to GBP instead costs ~£125k (4.9%).
- Subscriptions: offer Stripe Bacs and SEPA Direct Debit next to cards (~£106k total). GoCardless saves nothing at £8.
- Merchant of record for digital subscriptions (Stripe Managed Payments, Creem, Paddle) adds £1.2k–4k/month but removes worldwide VAT/GST registrations.
- At this volume, ask Stripe for interchange-plus pricing and get an Adyen quote (0.3–0.8 points off international cards).

## Why these choices

- Database: at 100k DAU the working set needs ~16 GB RAM. Neon at that size is $326 (Launch, no SLA) to $664 (Scale, no standby). PlanetScale PS-160 gives 3 nodes with HA for ~$300. The earlier "Neon 1–2 CU, $77–155" estimate was undersized.
- Auth: Better Auth is $0 at any MAU. Per-MAU options at 250k / 500k / 1M MAU: Supabase Auth $490 / $1,300 / $2,930; Clerk $4.6k–8.2k at 300k–500k; WorkOS AuthKit free to 1M (fallback).
- Images: Bunny CDN + Optimizer ~$142; CloudFront ~$1,000; Cloudinary or ImageKit ~$4,500.
- Video: Mux ~$2,140 (best DX, analytics, captions); Cloudflare Stream ~$2,460.
- Email: Resend ~$215 at 300k. Templates in React Email keep switching cheap.

## Cost levers (put these in the template code)

- Keep CDN requests ≤150M/month for the $300 flat tier. Keep `partialPrefetching`, prefetch on hover, scope `proxy.ts` with a matcher.
- Never serve images or video through Vercel. Custom `next/image` loader to R2 sizes; `clientUploads: true`.
- Wrap Payload reads in `'use cache'` + `cacheTag`; `revalidateTag(tag, 'max')` from Payload hooks.
- Set Payload `defaultDepth: 1` (each depth level adds a query per related collection).
- Turn on the Better Auth cookie cache (removes a DB query per session check).
- Use `pg` + `attachDatabasePool`, database in the same region as functions (us-east-1 / iad1).
- Route with Jev before the LLM; send only real multi-step work to the deep agent. Cap output tokens, use gateway prompt caching.
- Checkpoint simple turns with `durability="exit"`, prune to the latest checkpoint per thread, expire threads after 90 days.
- Sample tracing: 10% of chat turns, all deep runs.
- Run BotID Deep Analysis only on signup and first AI call per session.
- Set a Vercel spend budget with alerts, not the hard stop.

## Gotchas

- Vercel Pro includes only 1M CDN requests and 1 TB (Flat Rate CDN GA 2026-09-08); existing teams must opt in. No included CPU, memory, or invocations; the $20 credit covers usage.
- With Cache Components, most page views still run one function for the dynamic holes.
- Payload Jobs polling every minute keeps the database awake, so serverless scale-to-zero never applies in production.
- `payload-auth` has ~8.5k weekly downloads and open issues; prefer standalone Better Auth.
- Payload's ecommerce plugin is beta and Stripe-only. Its tenant plugin and Better Auth orgs track members separately.
- Stripe Managed Payments is digital-only and Checkout-only.
- Gemini 3.8 Flash doubles in price on 2027-01-01. Claude models from 4.7 on emit ~30% more tokens.
- `deepagents` 0.7 is beta; `ag-ui-langgraph` 0.0.x and `copilotkit` (Python) 0.1.x are early. Pin exact versions.
- Docling needs torch: over Vercel's 500 MB Python bundle (5 GB large functions are beta, with a 4.5 MB body cap); `unstructured` doesn't support Python 3.14. Parse on a container worker or use Mistral OCR.
- Unpruned LangGraph checkpoints grow ~420 GB/month.
- Deep runs need background start and resumable streams if the client disconnects.
- Jev is early access, 40 requests/s cap; keep a small-model fallback.
- Consent: no marketing cookies, pixels, or server-side ad events before consent (PECR, ePrivacy). Double opt-in for EU email. Record consent on the user.
- Hetzner raised prices 2026-06-15 and some CPX/CCX types showed unavailable; confirm in the console.
- Stripe agentic commerce 0.5% fee and Radar per-transaction rates come from third-party sources.
- Unverified: Bunny rendition storage; cache-hit rates; Langfuse units per trace.

## Sources

Read 2026-10-02: vercel.com/docs/pricing/flat-rate-cdn · vercel.com/docs/functions/usage-and-pricing · planetscale.com/pricing · neon.com/pricing · supabase.com/pricing · stripe.com/gb/pricing · docs.stripe.com/payouts/multicurrency-settlement · stripe.com/gb/tax/pricing · developers.cloudflare.com/r2/pricing · bunny.net/pricing/cdn · docs.bunny.net/docs/stream-pricing · mux.com/docs/pricing/video · vercel.com/docs/ai-gateway/pricing · aws.amazon.com/ses/pricing · posthog.com/pricing · sentry.io/pricing · pypi.org/project/deepagents · docs.copilotkit.ai · docs.typesafe.ai · langfuse.com/pricing · exa.ai/pricing · loops.so/pricing · developers.facebook.com/docs/whatsapp/pricing · docs.hetzner.com/general/infrastructure-and-availability/price-adjustment · dataforseo.com/pricing · developers.google.com/data-manager/api · docs.stripe.com/agentic-commerce · upstash.com/pricing/redis

## Related

- ADR: `docs/adr/0001-stack.md`
- What each module does and which site types use it: `docs/knowledge/template-modules.md`
