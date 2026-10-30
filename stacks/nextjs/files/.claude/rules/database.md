---
paths:
  - "**/migrations/**"
  - "**/schema.*"
  - "**/*.sql"
  - "packages/db/**"
  - "python/core/src/__PYNAME___core/db.py"
---
<!-- last-verified: 2026-10-03 -->
# Database

- Schema changes go through drizzle-kit migrations (`pnpm db:generate`). Never edit applied migrations.
- Migrations must be backward compatible with the currently deployed code (expand → migrate → contract).
- Every foreign key and frequent filter column gets an index. Justify any missing one.
- No destructive migration (drop/rename column/table) without explicit user approval.
- Never point local tooling at production; local Postgres comes from `pnpm db:up`.
- App queries use the pooled `DATABASE_URL`: no LISTEN/NOTIFY, session locks, `SET`, or temp tables there.
- No `CREATE INDEX CONCURRENTLY` in migration files; drizzle runs them in one transaction.
- Timeouts are role defaults (`0014_role_timeouts.sql`); never put timeouts or `options` in pooled config or URLs. Raise one per transaction with `set_config(..., true)`.
- Vectors use HNSW indexes only. Details: docs/knowledge/database.md.
