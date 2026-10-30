<!-- last-verified: 2026-10-02 -->
# Consent

How the template asks for cookie consent, stores proof of it, and makes every tracker obey it. Read before adding an analytics or marketing script, changing the banner, or setting up a project for a new region.

## Pieces

| Piece | Where | Job |
| --- | --- | --- |
| Backend | `apps/web/src/lib/consent/backend.ts`, route `apps/web/src/app/api/c15t/[...path]/route.ts` | Self-hosted c15t: policy, banner copy, consent records |
| Tables | `consent` Postgres schema, `packages/db/src/schema/consent.ts` (generated) | Append-only consent proofs, subjects, policies, audit log |
| Settings | `apps/web/src/lib/consent/config.ts` | API path, categories, expiry (182 days) |
| Copy | `apps/web/src/lib/consent/consent-copy.ts` | Banner and dialog words (VOICE.md, checked by `pnpm copy:check`) |
| Look | `apps/web/src/lib/consent/theme.ts` | Token CSS variables and our utility classes; no literals |
| Banner, dialog, scripts | `apps/web/src/components/consent/ConsentManager.tsx` in the site layout | Provider, GA4, mirror into analytics |
| Reopen | `CookieSettingsLink` (home footer, auth shell) and the account user menu | Withdraw as easily as you gave consent |

## How a choice flows

1. `C15tPrefetch` starts `GET /api/c15t/init` before hydration; the backend resolves the policy and copy.
2. Nothing optional runs before a choice: PostHog isn't started and GA4 isn't loaded.
3. The visitor accepts, rejects, or chooses. c15t writes its `c15t` cookie (the source of truth) and `POST /api/c15t/subjects` stores the record (masked IP, user agent, language, policy).
4. `AnalyticsConsentBridge` works out one state (`apps/web/src/lib/consent/state.ts`): undecided (no choice, a policy change that needs a fresh choice, or older than 182 days), denied, or granted. Granted starts PostHog and writes `__PYNAME___analytics_consent` (expiring with the choice) for server code; anything else removes it. An expired choice is cleared so the banner asks again; if it had granted measurement, trackers are withdrawn and the page reloads, since GA4 may already have loaded from it. Rejecting means PostHog never starts. c15t's cookie format is internal, so server code reads only the mirror.
5. GA4 (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) loads after measurement consent with Consent Mode v2 signals.
6. Turning any category off runs `withdrawTrackers`, then reloads. PostHog is reset, then opted out (in that order: `reset()` clears the opt-out flag), and its `ph_*` localStorage is cleared. `ph_*`, `_ga*`, and the mirror cookie are deleted host-only and on every parent domain, where GA4 and PostHog set them in production. Accepting again lifts PostHog's opt-out. c15t's own reload is off because it doesn't wait for that cleanup.

## Rules

- One opt-in policy everywhere, accept and reject with equal weight (`POLICY_PACKS` in `backend.ts`). A client project that needs regional rules adds c15t policy packs there, not in the frontend.
- New third-party script? Add it to `SCRIPTS` in `ConsentManager.tsx` with its category, and keep `alwaysLoad` off. Never load a tracker with a plain `<Script>`.
- New category? Add it to `CONSENT_CATEGORIES`, the copy, and the policy; tell the user what it's for, not which cookies it sets.
- Consent tables come from c15t: after upgrading `@c15t/backend`, run `pnpm --filter web consent:schema`, then `pnpm db:generate`, and commit both. Never edit `consent.ts` by hand.
- The consent API is public. `apps/web/src/lib/consent/request-guard.ts` runs first: no PATCH/PUT/DELETE (account linking happens server-side, later), bodies over 8 KB refused (read with a cap, so chunked bodies can't bypass it), `givenAt` outside the choice's lifetime refused, `GET /consents/check` (lookup by account id) refused, only our own hostnames as `domain`, client-sent account ids stripped. c15t's schema ships no indexes; `0005_consent_indexes.sql` adds the lookup ones by hand. The policy uses `scopeMode: "strict"`, so unknown categories are rejected. Requests are rate limited per IP before the guard (docs/knowledge/rate-limits.md).
- The stored IP comes only from `x-real-ip` (set by Vercel); c15t would otherwise trust client-sent headers. If you add regional policy packs, note c15t reads country from `x-c15t-country` and `cf-ipcountry` before `x-vercel-ip-country`.
- c15t stores JSON columns as `{ "json": value }`; SQL and GDPR exports read `->'json'`.
- Held on c15t 2.3.0. v3 drops the Drizzle adapter and `@c15t/backend/db/schema` (self-hosting needs `@effect/sql-pg` and c15t's own migrator owning the consent tables), writes unwrapped JSON, adds `timestamp` columns without a time zone, and wants its own `/api/c15t/[...c15t]` route. Plan the move with `/feature`; the upgrade guide ships in `@c15t/nextjs/docs/frameworks/next/upgrade-v3.md`.
- Retention: keep consent records until `validUntil` plus 2 years (proof for complaints); the daily `consent-retention` job deletes them (docs/knowledge/jobs.md).
- `getDb()` keeps its Drizzle instance across dev hot reloads; after a schema change restart `pnpm dev`, or c15t's health check (`/api/c15t/status`) reports the database down.
- Client projects must add a privacy and cookie policy page and pass it as `legalLinks` before launch.

## Later phases

- Account linking and erasure: docs/knowledge/compliance.md.
- Conversions phase: `@__NAME__/conversions` (Google Data Manager API, Meta CAPI) sends ad conversions only with `marketing` consent, from a marketing mirror and a consent snapshot stored with each signup or order (webhooks have no cookies). See docs/knowledge/stack-fit.md.
