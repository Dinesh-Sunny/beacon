---
paths:
  - "packages/auth/**"
  - "apps/web/src/lib/auth*.ts"
  - "apps/web/src/lib/session.ts"
  - "apps/web/src/app/api/auth/**"
  - "python/core/src/__PYNAME___core/auth.py"
---
<!-- last-verified: 2026-10-03 -->
# Auth (Better Auth)

- One server config: `createAuth()` in `packages/auth/src/auth.ts`; apps call `getAuth()`, never `betterAuth()` directly.
- Roles and permissions live only in `packages/auth/src/access.ts`; server and client both import them.
- Server Actions and route handlers acting for a user call `requireSession()` / `requireOrgPermission()` first.
- Never read the session inside `"use cache"`; wrap session-reading components in `<Suspense>`.
- After changing plugins: regenerate the schema, re-apply the hand edits noted in its header, then `pnpm db:generate`.
- Keep `better-auth` and all `@better-auth/*` packages on one exact version.
- Client components import only `@__NAME__/auth/config`, `@__NAME__/auth/access`, or `@__NAME__/auth/client`; the package root pulls the server config (and `pg`) into the browser.
- Auth forms call `authClient` (HTTP): rate limiting and origin checks run only on HTTP requests, never on server-side `auth.api.*` calls.
- Never export values from a `"use client"` module for server code; server imports get references, not data. Shared constants go in plain modules.
- Details: docs/knowledge/auth.md.
