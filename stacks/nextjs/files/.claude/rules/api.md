---
paths:
  - "apps/web/src/app/api/**"
  - "**/server/**"
  - "**/routes/**"
  - "**/actions/**"
---
<!-- last-verified: 2026-10-03 -->
# API / server

- Validate request input at the edge of every handler (Pydantic in Python; see security.md for TS). Cap body size, including chunked bodies without `content-length`.
- Errors: `Response.json({ message }, { status })` with named status constants. Log internal causes with an `[area]` prefix; never return them, secrets, or PII.
- AuthZ check first, before any data access (auth.md).
- Handlers stay thin; logic lives in `apps/web/src/lib/` (model: `apps/web/src/lib/agent-proxy.ts`).
- Idempotency for retries on mutating endpoints where clients may retry.
- Rate-limit public and costly endpoints with `consumeWithFallback` from `@__NAME__/ratelimit`; a 429 carries `Retry-After`. Paginate list endpoints.
