<!-- last-verified: 2026-10-02 -->
# Observability

How the template reports errors (Sentry), product events (PostHog), and logs (Axiom). Read before adding an error boundary, an analytics event, a logging call, or before turning any of these on for a project.

## Pieces

| Concern | Where | Off until |
| --- | --- | --- |
| Browser errors and traces | `apps/web/src/instrumentation-client.ts` | `NEXT_PUBLIC_SENTRY_DSN` |
| Server and edge errors | `apps/web/src/instrumentation.ts` (`onRequestError`), `sentry.server.config.ts`, `sentry.edge.config.ts` | same DSN |
| Caught render errors | `ErrorPanel` (every `error.tsx`) and `apps/web/src/app/global-error.tsx` report once and show the digest as a reference | same DSN |
| Shared Sentry options | `apps/web/src/lib/observability/sentry-options.ts` | |
| Secret scrubbing | `apps/web/src/lib/observability/scrub.ts` (URLs) and `scrub-events.ts` (whole Sentry events and PostHog captures), mirrored in `__PYNAME___core.observability` | always on |
| Sidecar errors | `python/api/src/__PYNAME___api/observability.py` (`sentry-sdk[fastapi]`) | `SENTRY_DSN` |
| Browser analytics | `apps/web/src/lib/observability/analytics.ts` (`posthog-js`) | `NEXT_PUBLIC_POSTHOG_KEY` and measurement consent |
| Server events | `apps/web/src/lib/observability/posthog-server.ts` (`posthog-node`), fed by `apps/web/src/lib/auth-events.ts` | `NEXT_PUBLIC_POSTHOG_KEY` and the consent cookie |
| Consent mirror | `apps/web/src/lib/observability/consent.ts` (`__PYNAME___analytics_consent`, present only while granted) | the consent banner |
| Logs | stdout from every service → Vercel log drain → Axiom | drain configured in Vercel |

## Rules

- Never send email, names, or IPs to Sentry or PostHog. Users are identified by id only (`identifyUser`, `AnalyticsIdentity` in signed-in shells); `resetIdentity` runs on sign-out and account deletion.
- URLs can hold sign-in, reset, and invitation secrets, and they show up in more places than the request: span attributes (`http.target`, `url.full`, `url.path`, `url.query`), span descriptions, transaction names, breadcrumbs, and PostHog's `$session_entry_*`, `$set`, and `$set_once`. `scrub-events.ts` scrubs every URL-like key; PostHog's `mask_personal_data_properties` adds a second layer for query params. Adding a link with a secret? Add its query name or path prefix to both scrub lists (TS and Python) with a fixture test.
- Sentry collects broadly by default (JS 11 and Python 2.x alike). `dataCollection` in `sentry-options.ts` and `DATA_COLLECTION` in the sidecar turn off cookies, bodies, user info, DB values, GraphQL documents, AI inputs, and (Python) frame locals, and allow only three request headers. `send_default_pii=False` alone still sends Python request bodies. Don't widen either without a privacy reason.
- No session replays until the consent phase asks for them.
- PostHog starts only after the visitor accepts measurement (`applyAnalyticsConsent`, driven by the consent banner; docs/knowledge/consent.md). Before a choice or after a rejection no PostHog code runs. `advanced_disable_flags` keeps flag and remote-config calls off.
- Feature flags come from the Flags SDK (flags in Payload), not PostHog.
- Event names live in `analytics-events.ts` (snake_case, past tense). Product facts the server knows (sign-up, purchase) are server events; UI interactions are client events.
- Server events follow the same choice: `captureServerEvent` reads the consent cookie during the request and sends nothing without `granted`. Outside a request (scripts, tests) it sends nothing and never throws.
- Browser traffic is same-origin: PostHog through `ANALYTICS_INGEST_PATH` (route /ingest, rewrites in `next.config.ts`), Sentry through `SENTRY_TUNNEL_ROUTE` (route /monitoring, tunnel with `?o=&p=`; it relays to whichever org the client names, which is the SDK's design). Both are in `PRIVATE_PATH_PREFIXES`, so robots skip them. `skipTrailingSlashRedirect` is on for PostHog's `/e/` endpoints, and a redirect in `next.config.ts` restores the trailing-slash 308 for every other path.
- Logging: write to stdout/stderr with a `[area]` prefix and no secrets or personal data. Axiom parses Vercel's drain; filter by `vercel.projectName`, `vercel.source` (`lambda`, `edge`, `build`), and the prefix.
- `@__NAME__/auth` depends on `@opentelemetry/api` (same version Sentry brings) so pnpm resolves one copy of Better Auth core; drop it only if `pnpm typecheck` stays clean.

## Setup per project

1. Sentry: create a Next.js project and a Python project (or reuse one). Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`. For readable stack traces, set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` (build env only) so source maps upload and are removed from the deployment.
2. PostHog: create an EU Cloud project (or US: `NEXT_PUBLIC_POSTHOG_REGION=us`), set `NEXT_PUBLIC_POSTHOG_KEY`. Turn off "Use IP address" geolocation if the privacy notice doesn't cover it.
3. Axiom: add the Axiom integration from the Vercel Marketplace (it creates the log drain for every service in the project). No code change.
4. Check: `/api/health` for email and the database; trigger a test error from a preview and find it in Sentry by its digest.

## Later phases

- Replays: off; turning them on needs their own consent category.
- Account deletion deletes the PostHog person (docs/knowledge/compliance.md); Sentry holds only ids.
- AI phase: Langfuse traces agents; Sentry's AI integrations stay off (`genAI` inputs and outputs disabled).
