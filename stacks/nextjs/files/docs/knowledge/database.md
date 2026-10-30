<!-- last-verified: 2026-10-03 -->
# Database

How the template connects to Postgres from Next.js and the Python sidecar, and the rules that keep it working on Neon, PlanetScale, and local Docker. Read before adding tables, queries, migrations, or a new database consumer.

## Providers

| Environment | Provider | How it's set up |
| --- | --- | --- |
| Local, tests | Docker, pgvector 0.8.5 on Postgres 18 (`compose.yaml`) | `pnpm db:up`; CI uses the same image as a service |
| Vercel previews | Neon, one branch per deployment | Neon Vercel integration injects the env vars |
| Production | PlanetScale Postgres (HA once traffic needs it) | Env vars set by hand; Neon also works for small projects |

Postgres **18** everywhere. Use only extensions that all three have: `vector` (HNSW indexes; no pgvectorscale, Neon lacks it), `pg_trgm`, `unaccent`, `ltree`, `btree_gist`, `btree_gin`, plus `pg_stat_statements` for query stats. Decision and costs: `docs/adr/0001-stack.md`, `docs/knowledge/cost-model.md`. Graph data (edges, trees, traversal) stays in Postgres too: `docs/knowledge/graph.md`. So do documents (`jsonb`): `docs/knowledge/document-data.md`.

## Environment variables

| Name | Points at | Used by |
| --- | --- | --- |
| `DATABASE_URL` | Pooled endpoint. Neon: `-pooler` host. PlanetScale: port 6432 | App queries (Next.js, sidecar) |
| `DATABASE_URL_UNPOOLED` | Direct endpoint. Neon: host without `-pooler`. PlanetScale: port 5432 | Migrations, `CREATE EXTENSION`, LangGraph `setup()`, LISTEN/NOTIFY |

Locally both point at Docker and live in `apps/web/.env.local` (created by `pnpm setup`). Every DB script, `pnpm dev:py`, and pytest read that file; real environment variables win.

## Code map

- `packages/db` (`@__NAME__/db`): Drizzle `0.45.2` on a `pg` Pool. Pinned to match `@payloadcms/drizzle`; upgrade both together.
  - `getDb()`: lazy client, one pool per process, registered with `attachDatabasePool`. Importing it never needs a database, so `next build` works without one.
  - `checkDatabase()`: `select 1` with latency; `apps/web/src/app/api/health/route.ts` serves it.
  - `packages/db/src/schema/index.ts`: export every app-owned table here. Payload (phase 2) manages its own tables. `consent.ts` is generated from c15t (docs/knowledge/consent.md).
  - `packages/db/src/config.ts`: pool settings, env names, migration lock key.
  - `packages/db/src/json.ts`: bound, index-friendly `jsonb` filters (`jsonContains`, `jsonPathExists`, `jsonText`).
  - `packages/db/src/batch.ts`: `deleteInBatches()` for retention and cleanup deletes.
  - `packages/db/src/testing.ts`: `createScratchDatabase()` for integration tests (migrated throwaway database).
  - `packages/db/src/graph.ts`: `ltree` column type, tree filters, `walkGraph()`, and the shared `graph_edges` table's helpers (docs/knowledge/graph.md).
  - `normalizeConnectionString()` drops `sslrootcert=system` (PlanetScale strings); node-pg reads it as a file path.
- `python/core/src/__PYNAME___core/db.py`: psycopg 3 `AsyncConnectionPool` with `autocommit`, `dict_row`, `prepare_threshold=None`. Pass this pool to LangGraph's `AsyncPostgresSaver` and store; don't use `from_conn_string`, and don't use asyncpg.
- `python/api`: opens the pool in the FastAPI lifespan; `GET /health/ready` reports it.

## Commands

| Task | Command |
| --- | --- |
| Start / stop local Postgres | `pnpm db:up` · `pnpm db:down` (data persists in a Docker volume) |
| Generate a migration from schema changes | `pnpm db:generate` |
| Hand-written migration (DDL drizzle can't express) | `pnpm --filter @__NAME__/db exec drizzle-kit generate --custom --name=<slug>` |
| Apply migrations (Drizzle, then Payload, under one lock) | `pnpm db:migrate` |
| New Payload migration after collection changes | `pnpm cms:migrate:create <name>` |
| Browse data | `pnpm db:studio` |

## Settings

Every value below lives in `packages/db/src/config.ts` (Python mirrors it in `__PYNAME___core.db`). Checked against the Postgres 18, Neon, PlanetScale, PgBouncer, node-postgres, psycopg_pool, and Vercel docs on 2026-10-03.

| Setting | Value | Where | Why |
| --- | --- | --- | --- |
| `statement_timeout` | 15 s | Role default, migration 0014 | Stops runaway queries. Above Payload's normal admin queries; Postgres default is off |
| `lock_timeout` | 5 s | Role default | A blocked write fails instead of queueing others behind it; must stay below `statement_timeout` |
| `idle_in_transaction_session_timeout` | 30 s | Role default | Ends a transaction left open (crashed request, awaited network call) that would hold locks |
| `transaction_timeout` (Postgres 17+) | 1 min | Role default | Caps a whole transaction; above idle-in-transaction so both fire. Ends the session: the query rejects, `registerPool()` keeps the dead client's error from crashing the process, and the pool replaces it |
| `application_name` | `__NAME__-web`, `__NAME__-payload`, `__NAME__-api`, `__NAME__-migrate` | Pool config | Who is running what in `pg_stat_activity` and query stats; PgBouncer passes it through |
| Connection lifetime | 1 h | `maxLifetimeSeconds`, psycopg `max_lifetime` | PlanetScale wants under 24 h for clean failovers; also picks up changed role defaults |
| TCP keepalive | on | `pg` `keepAlive` | Notices connections dropped while a Fluid instance is suspended |
| Migration session | timeouts 0; `lock_timeout` 0 while waiting for the migration lock, then 10 s | `withMigrationLock()`, Payload pool while `PAYLOAD_MIGRATING=true` | Long migrations finish and wait for a parallel deploy; DDL that can't get its lock fails the deploy instead of blocking traffic |
| `idle_session_timeout` | off | | Postgres warns against it behind poolers |

- Timeouts are role defaults because both poolers refuse them as startup parameters, and no superuser is needed: a role may set its own (`ALTER ROLE CURRENT_USER IN DATABASE ... SET`). They apply at login, so pooled connections pick them up as they recycle.
- Never put timeouts or `options` in pooled connection config or `?options=` on pooled URLs: Neon fails with "unsupported startup parameter". The direct URL accepts them, but keep `options` and `application_name` out of it too: query-string values override the migration settings in code.
- Big deletes (retention, cleanup) go through `deleteInBatches()` (`DELETE_BATCH`): one unbatched delete is all-or-nothing, so once its backlog outgrows the statement timeout it fails every run.
- Run Payload's own `payload migrate:*` commands with `PAYLOAD_MIGRATING=true`; its CLI sets the flag only after loading the config, so they would otherwise run on the pooled URL under app timeouts. `pnpm db:migrate` sets it correctly.
- Need longer for one known-slow statement? Raise it inside its transaction: `select set_config('statement_timeout', '60s', true)` (`walkGraph` lowers it the same way). Don't raise the role default.
- If the app ever connects with a different role than migrations, run the four `ALTER ROLE` lines from `0014_role_timeouts.sql` for that role too.
- Prefer server timeouts to `pg`'s `query_timeout`: it only rejects in the client, leaves the query running, and would cut short a deliberately raised timeout.
- New internal tables: `pg_catalog.uuidv7()` primary keys (time-ordered, index-friendly). Keep `gen_random_uuid()` for ids users see or that act as secrets: v7 reveals creation time (RFC 9562 section 8).
- Every foreign key has an index except three on the generated c15t `consent.consent` table (`domainId`, `policyId`, `runtimePolicyDecisionId`). They only matter when a parent row is deleted, which consent's `RESTRICT` keys make rare, and an index on that append-only table would slow every write.

Query stats: local Docker preloads `pg_stat_statements` and logs statements over 500 ms (`compose.yaml`). Neon keeps stats until the compute suspends. PlanetScale's Query Insights works without it.

```sql
select calls, round(mean_exec_time) as ms, query from pg_stat_statements order by total_exec_time desc limit 20;
```

## Rules

- The app path goes through PgBouncer in transaction mode. Never use LISTEN/NOTIFY, session advisory locks, `SET`, or temp tables on `DATABASE_URL`; use the direct URL. Queue workers use `FOR UPDATE SKIP LOCKED`.
- Migrations run once per deploy (CI and the Vercel web `buildCommand`), never at request time or cold start. `apps/web/src/scripts/migrate.ts` holds a session advisory lock (`withMigrationLock()`), runs Drizzle, then Payload, so parallel deploys apply them one at a time.
- Payload owns the `payload` schema (created by Drizzle migration 0001); our Drizzle tables stay in `public`. Payload has its own pool (max 5) registered through `registerPool()`.
- Vercel builds migrate only when `DB_MIGRATE_ON_BUILD=1`. Set it on Production, and on Preview only when previews get their own Neon branch; otherwise a PR's migration would hit the shared database.
- Drizzle runs all pending migrations in one transaction: no `CREATE INDEX CONCURRENTLY` in migration files. Build big indexes in a separate manual step.
- Vectors: HNSW only, so local, preview, and production behave the same.
- Partition maintenance (pg_partman, when ledgers arrive) is scheduled by Vercel Cron, not pg_cron: Neon's pg_cron only runs while compute is awake.
- Pools (JS and Python) follow Vercel's Fluid guidance: `min 1`, `max 10`, idle 5 s, connect timeout 5 s, lifetime 1 h. Raise `max` only after checking the provider's connection limit.
- Connection budget per web instance: ours up to 10 + Payload up to 5 (one held permanently for reconnects).

## Provisioning

Creating databases changes paid accounts, so run these yourself.

Neon (previews, or small production):

```bash
vercel link                   # once per checkout
vercel integration add neon   # pick region us-east-1 (next to iad1 functions) and Postgres 18
vercel env pull apps/web/.env.local
```

Then set `DB_MIGRATE_ON_BUILD=1` for Production (and Preview once branching is on): `vercel env add DB_MIGRATE_ON_BUILD production`.

In the Neon integration settings, turn on preview branching with "Resource must be active before deployment" and set up branch cleanup (https://neon.com/docs/guides/vercel-branch-cleanup); otherwise branches live as long as their deployments.

For production on Neon, turn scale-to-zero off and set the minimum compute large enough to keep the working set in memory (Neon's production checklist). Previews keep scale-to-zero on.

PlanetScale (production):

1. Create a Postgres 18 database in `us-east-1`, then a role and its connection strings in the dashboard.
2. Enable `vector`, `pg_trgm`, `unaccent`, `ltree`, `btree_gist`, and `btree_gin` under Extensions if a migration fails on permissions. Enable `pg_stat_statements` there too (it needs a restart), then run `CREATE EXTENSION pg_stat_statements;`; migration 0013 only warns while it's missing.
3. In Vercel, set `DATABASE_URL` (port 6432), `DATABASE_URL_UNPOOLED` (port 5432), and `DB_MIGRATE_ON_BUILD=1` for Production.
4. Read `max_connections` under the branch Parameters before raising pool sizes (not published per size).
5. Use a dedicated PgBouncer for production: it pauses instead of dropping connections during failover. Raise its `max_client_conn` above the default 100: each web instance opens up to 15 (ours 10 + Payload 5).
6. Turn on `track_io_timing` under Parameters so Query Insights shows I/O time.

## Self-hosted tools

Listmonk, Umami, Fider, Postiz, and Cal.com share one local Postgres 17 container on the Hetzner box (one database each), not Neon or PlanetScale: they hold long sessions and would pay latency and egress. OpenStatus uses libSQL.

## Not yet verified

- The `buildCommand` inside a Vercel service on a real deploy (first Neon preview will show it).
- `CREATE EXTENSION vector` under a non-superuser PlanetScale role.
- A native Vercel Marketplace integration for PlanetScale Postgres.
- How Payload's jobs queue claims jobs (check in phase 2).
