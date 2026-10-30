<!-- last-verified: 2026-10-02 -->
# Auth (app users)

For whoever touches sign-in, sessions, organizations, API keys, or service-to-service calls. App users (customers, org members) use Better Auth 1.7; CMS staff sign in to Payload separately (`docs/knowledge/payload.md`). Two systems, two cookie sets, two Postgres schemas.

## Code map

- `packages/auth` (`@__NAME__/auth`): `createAuth()` (the single server config), `origins.ts` (allowed hosts and canonical origin per environment), `access.ts` (org roles and permission statements, shared with the client), `client.ts` (typed React client), `config.ts` (policies and constants), `email.ts` (send seam), `events.ts` (audit/GDPR event seam).
- `apps/web/src/lib/auth.ts`: lazy `getAuth()` (no DB at build), `after()` for deferred work such as emails, `nextCookies()`.
- `apps/web/src/lib/session.ts`: `getSession()`, `requireSession()`, `requireOrgPermission()`.
- `apps/web/src/lib/auth-client.ts`: browser client. Route handler at `apps/web/src/app/api/auth/[...all]/route.ts`.
- `packages/db/src/schema/auth.ts`: generated tables in the `auth` Postgres schema (`pnpm --filter @__NAME__/auth auth:generate`, then re-apply the hand edits noted at the top, then `pnpm db:generate`).
- `python/core/src/__PYNAME___core/auth.py`: verifies service tokens in the sidecar; `GET /v1/me` is the example endpoint.

## What's on

| Feature | Setting |
| --- | --- |
| Email + password | Verification required, min 12 chars, breached-password check (haveIBeenPwned); signing up with an existing email emails the owner instead of revealing the account |
| Magic link, two-factor (TOTP + backup codes) | On; magic links are never sent or honoured for accounts with two-factor on (Better Auth's two-factor check doesn't cover them) |
| Organizations | Roles owner/admin/member from `access.ts`; extra statements `apiKey`, `billing`; invitations expire in 48 h |
| Admin plugin | Our support staff only (ban, impersonate) |
| API keys | Owned by organizations, prefix `agk_`, per-key rate limits; org owners and admins can create, update, and delete; deleted with their org |
| Service tokens | `jwt()` EdDSA (Ed25519), 15 min, `iss` = canonical origin, `aud` = `__NAME__-api`, claims `sub`, `email`, `role`, `impersonatedBy`; keys rotate every 30 days (7-day grace), JWKS at `/api/auth/jwks` |
| Sessions | 7 days, refreshed daily, 5-minute signed cookie cache (revocation lag up to 5 min) |
| Rate limiting | On, counters in Upstash when configured, else Postgres (`auth.rate_limit`); docs/knowledge/rate-limits.md |
| Billing | Stripe plugin, organizations pay; docs/knowledge/payments.md |
| Trusted hosts | Only this environment's own: `BETTER_AUTH_URL` host and production domain in production; the deployment and branch URLs on previews; `localhost:*` outside production. Never a wildcard like `*.vercel.app`: every trusted host is also a valid reset/callback redirect |

## Rules

- Read the session only inside a `<Suspense>` boundary (it reads headers, so it's dynamic), never inside `"use cache"`.
- Every Server Action and route handler that acts for a user calls `requireSession()` or `requireOrgPermission()`; UI checks are hints only.
- One `BETTER_AUTH_SECRET` per database: JWT signing keys are encrypted with it. Rotate with `BETTER_AUTH_SECRETS`, never by swapping the value.
- Locally, deleting `apps/web/.env.local` and rerunning `pnpm env:init` generates a new secret; reset the database too (`docker compose down -v`), or JWT signing fails.
- Calling the sidecar for a user: get a token with `getAuth().api.getToken({ headers })` and send it as `Authorization: Bearer`; never forward the session cookie.
- Emails go through `SendAuthEmail`. apps/web passes `sendAuthEmail` (`apps/web/src/lib/auth-email.ts`): React Email templates sent through `@__NAME__/email` (docs/knowledge/email.md). Production needs `EMAIL_FROM` and `AWS_SES_REGION`; without them sends fail in the background (users get no error), so check `/api/health`.
- Invitations are rate limited per IP (`INVITE_RATE_LIMIT`): they put user-typed organization names into email from our domain.
- Canonical origin rules exist twice (`origins.ts`, `__PYNAME___core.auth.resolve_issuer`); change both together.

## Screens (phase 3b)

- Auth pages live in `apps/web/src/app/(frontend)/(auth)/`: sign in (password or email-link tabs), sign up (with the check-inbox step), verify email, forgot and reset password, two-factor challenge, accept invitation. They share `AuthShell`: the form on the left, and from `lg` a quiet muted panel (faint grid, hidden under reduced motion, plus a card listing protections read from `@__NAME__/auth/config`); primary colour is kept for the next action.
- The account area (route /account) is a sidebar app shell (`apps/web/src/app/(frontend)/account/layout.tsx`): organization switcher, nav from `apps/web/src/lib/account-nav.ts`, user menu. Pages: the index (profile, security summary, delete account), `/account/security` (two-factor, password, devices), `/account/security/two-factor` (setup), `/account/team` (members, invitations), `/account/api-keys`. Data comes from `apps/web/src/lib/account.ts`; `getAccountContext()` is cached per request so the layout and page share one read.
- Shared pieces: `PasswordInput` (show/hide), `PasswordStrength` (guidance only; the server enforces policy and breach checks), `OtpField` (six slots, submits when full), `InboxNotice` (webmail shortcut from `apps/web/src/lib/mail-providers.ts`), resend cooldown, animated icons that respect reduced motion via `MotionProvider`.
- Keep a dialog that shows a one-time secret (new API key) outside any branch that flips on refresh, or the remount loses the secret.
- Forms are client components calling `authClient`, so Better Auth's rate limiting and origin checks apply; server components read data inside `<Suspense>`.
- `apps/web/src/proxy.ts` redirects account routes to sign-in when there's no session cookie; pages still check the session.
- Copy facts (link expiry, trusted-device window, reset signs out other devices) come from `packages/auth/src/config.ts`, so the text can't drift from the behavior.

## Not yet
- BotID captcha (ops), MCP + CIMD agent OAuth (agents), SSO/SCIM (optional, SAML/SCIM bugs open in 1.7).

## Known issues

- better-auth#9776: `nextCookies` can misdetect Server Component requests when `proxy.ts` exists; keep proxy to cookie-presence checks.
- better-auth#11353: a database blip at startup can break auth until the instance restarts; watch on Neon cold starts.
- better-auth#9920: generator emits `timestamp`, we hand-edit to `timestamptz`.
- In dev, adding the auth route handler can leave a stale route table (Payload's `/api/*` 404s); restart `pnpm dev`.
- haveIBeenPwned fails closed: if api.pwnedpasswords.com is down, sign-up and password changes return errors. The integration tests call it too.
- Previews: the sidecar fetches keys from the preview URL; Vercel Deployment Protection may block that fetch (not verified yet).
