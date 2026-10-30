<!-- last-verified: 2026-10-03 -->
# Rate limits

How the template limits requests to public endpoints: one shared counter store in Upstash Redis, used by Better Auth and the consent API. Read before exposing a new public route or changing a limit.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Limiter | `packages/ratelimit` (`@__NAME__/ratelimit`) | `consumeWithFallback(scope, key, rule)`: Upstash, else a per-instance memory count. Fixed window, one atomic Lua call per request |
| Settings | `packages/ratelimit/src/config.ts` | Env names, key prefix `__NAME__:ratelimit`, 1 s timeout |
| Auth | `packages/auth/src/auth.ts` | Better Auth `rateLimit.customStorage` when Upstash is configured, else `auth.rate_limit` in Postgres |
| Consent API | `apps/web/src/lib/consent/rate-limit.ts` | Per client (`clientKey(x-real-ip)`): saves 30/min, reads 600/min. Runs before the request guard |

## How it works

- Every count is one `EVAL` (INCR, then set the expiry whenever the key has none), so concurrent requests can't pass a stale read and a key can't block forever.
- Fixed window: up to twice the limit can pass across a window boundary. Better Auth's Postgres store counts from the last allowed request instead; the difference is accepted.
- Client keys come from `clientKey()`: IPv6 collapses to its /64 (as Better Auth does), and anything that isn't an IP shares one `unknown` bucket, so a forged header can't mint buckets.
- `@upstash/ratelimit` isn't used: its Lua scripts carry an Upstash-only shebang flag (`allow-key-locking`) that open-source Redis rejects, so they can't run locally or in CI.
- Falls back, never open: if Upstash is unset, slow (over 1 s), or down, counting moves to the instance's memory (weaker, never unlimited) and the error name is logged. Not the message: Upstash errors echo the command, which holds the client IP.
- The c15t client doesn't retry a `429`; it drops to offline mode and syncs the choice later, so the banner keeps working.
- Blocked requests get `429` with `Retry-After` in seconds.

## Environments

- Local and CI: `pnpm db:up` starts Redis plus Serverless Redis HTTP (Upstash's REST API over plain Redis) on `localhost:8079`. Copy the two `UPSTASH_*` lines from `apps/web/.env.example` into `apps/web/.env.local` (`pnpm setup` creates it from `.env.example` with generated local secrets when missing); without them the integration tests skip. CI runs the same pair as services.
- Vercel: add Upstash for Redis from the Marketplace (`vercel integration add upstash`). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which the limiter reads as well as the `UPSTASH_*` names.
- Without either pair, auth counts in Postgres and the consent API in memory per instance. Production must set it.

## Gotchas

- Integration tests in `packages/ratelimit` skip when no store is configured, like the DB tests; CI always has one.
- The Vercel WAF can add a coarse per-IP rule on `/api/c15t/*` and `/api/auth/*` in front of this, for floods that shouldn't reach a function at all.
