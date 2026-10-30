---
paths:
  - "apps/web/src/payload/**"
  - "apps/web/src/payload.config.ts"
  - "apps/web/src/migrations/**"
  - "apps/web/src/app/(payload)/**"
---
<!-- last-verified: 2026-10-03 -->
# Payload CMS

- Slugs, roles, and cache tags come from `apps/web/src/payload/constants.ts`; never inline them.
- After changing collections or fields: `pnpm cms:migrate:create <name>`, review the SQL, commit it. Push mode is off.
- Local API skips access control by default: pass `overrideAccess: false` (with `user`) when acting for a request.
- Scripts and migrations that write content pass `context: { disableRevalidate: true }`; hooks refresh with `'max'`, expire removals with `{ expire: 0 }`.
- Public reads filter by tenant themselves (the multi-tenant plugin scopes only staff); cache tags carry the tenant id.
- Never hand-edit `importMap.js` or `payload-types.ts`; regenerate with `pnpm --filter web cms:importmap` / `cms:types`.
- Keep all `@payloadcms/*` packages and `payload` on one exact version; upgrade them together with `@__NAME__/db`'s drizzle-orm and pg.
- Details and known issues: docs/knowledge/payload.md.
