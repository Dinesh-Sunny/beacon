# data-architect memory

<!--
  Persistent memory for the "data-architect" subagent (frontmatter: memory: project).
  Committed so the team shares what the agent learns. Claude Code loads the start of this file
  into the subagent's context, so keep it short. Use one line per entry and link detail files.
-->

## Data map
- Postgres 18 only (local Docker, Neon previews, PlanetScale prod). Extensions all three share: `vector`, `pg_trgm`, `unaccent`, `ltree`, `btree_gist`, `btree_gin`. Wiring: docs/knowledge/database.md
- App tables: Drizzle in `packages/db/src/schema/*.ts`, schema `public`, every table exported from `packages/db/src/schema/index.ts`. Migrations `packages/db/migrations/`
- CMS content: Payload collections in `apps/web/src/payload/collections/`, schema `payload`, own migrations in `apps/web/src/migrations/`. Slugs in `apps/web/src/payload/constants.ts`
- Generated, never hand-edit: `packages/db/src/schema/consent.ts` (c15t, schema `consent`), `payload-types.ts`
- Audit: `audit.events`, monthly partitions, append-only, ids only (migration 0015, docs/knowledge/compliance.md)
- AI threads: `agent_threads` + LangGraph checkpoint tables (migrations 0008, 0009, docs/knowledge/ai.md)
- Tenancy: Better Auth organization (`organization_id`) for app data; Payload `tenants` + multi-tenant plugin for content. No RLS: queries filter by tenant (docs/adr/0002-multi-tenancy.md)

## Choosing a store
- Relational table by default. Sparse or per-tenant shapes: `jsonb` column + `@__NAME__/db` json helpers (docs/knowledge/document-data.md)
- Graphs: shared `graph_edges` or own edge table, `ltree` for trees, `walkGraph()` (docs/knowledge/graph.md)
- Editor-managed content: Payload collection. Ephemeral keys, counters, rate limits: Upstash Redis. Work queues: Payload jobs (docs/knowledge/jobs.md)
- Personal data: add to export and erasure (docs/knowledge/compliance.md)

## Conventions
- Internal PKs `uuidv7()`; `gen_random_uuid()` for user-visible or secret ids. Timestamps `timestamp with time zone`
- Every FK and frequent filter indexed (consent's three RESTRICT FKs are the documented exception)
- Vectors HNSW only. Big deletes via `deleteInBatches()`. Slow statement: `set_config('statement_timeout', ..., true)` in its transaction
- Drizzle 0.45 lacks `WITH RECURSIVE` and jsonb operator builders: use the `sql` template / `json.ts` helpers

## Commands
- `pnpm db:generate` (schema → migration) · custom DDL: `pnpm --filter @__NAME__/db exec drizzle-kit generate --custom --name=<slug>`
- `pnpm cms:migrate:create <name>` after collection changes · `pnpm db:migrate` applies Drizzle then Payload under one lock
- Local psql: `docker compose exec postgres psql -U __NAME__ -d __NAME__` (after `pnpm db:up`)

## Known pitfalls
- No `CREATE INDEX CONCURRENTLY` in migrations: drizzle runs all pending ones in one transaction
- Pooled `DATABASE_URL` (PgBouncer transaction mode): no LISTEN/NOTIFY, session locks, `SET`, temp tables
- Recursive CTEs with `UNION ALL` + `CYCLE` enumerate paths, not nodes; dedupe with `UNION` on (node, depth)
- More DB traps found in review: .claude/agent-memory/code-reviewer/db-review-checks.md
