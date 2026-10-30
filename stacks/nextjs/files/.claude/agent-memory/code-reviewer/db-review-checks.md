---
name: db-review-checks
description: Recurring DB/pool defects in this repo (missing connect timeouts, lifespan state leaks, build-time migrations hitting shared DBs) and cheap ways to prove them
metadata:
  type: project
---

Seen reviewing feat/database (2026-10-02).

- node-pg `connectionTimeoutMillis` defaults to 0 (wait forever); psycopg_pool `timeout` defaults to 30 s. Check every pool config sets a bound. Prove it with `DATABASE_URL=postgresql://u:p@10.255.255.1:5432/db` and a `Promise.race` against a 15 s timer.
- FastAPI lifespans that set `app.state.X` and never reset it leak a closed pool into later tests on the shared `app`. Prove it by running pytest node IDs in reverse order.
- `uv run --env-file <path>` hard-fails when the file is missing. Node's `--env-file-if-exists` does not.
- Vercel `buildCommand` migrations run on every preview build too. Check what DB the Preview env points at.

**Why:** all four pass `pnpm check` and only fail in prod, on a reordered run, or on a fresh checkout.
**How to apply:** for any change to packages/db, __PYNAME___core.db, vercel.json, or the sidecar lifespan, run these checks before you sign off. See also [[hook-and-linter-pitfalls]].
- Recursive CTE walks with `UNION ALL` + `CYCLE` enumerate every simple path (fan-out^depth), not every node. Seen on feat/graph-on-postgres (2026-10-03): 200 nodes × fan-out 15 timed out at depth 6, while `UNION` on (node_id, depth) took 4 ms. Benchmark in a temp table via `docker exec -i __NAME__-postgres-1 psql`.
- jsonpath: `@?`/`@@` are silent, but `jsonb_path_exists/_match/_query(doc, path, vars)` raise unless the 4th arg `silent => true`. One malformed doc (strict key miss, `.double()` on "abc") fails the whole query. Seen on feat/document-data (2026-10-03).
- Test helpers that create a resource then do fallible setup (create db → migrate) must clean up on their own failure; callers' `after()` only sees the handle on success.
- node-pg: a FATAL (idle_in_transaction / transaction_timeout, server kill) on a CHECKED-OUT idle client emits `error` with no listener (pg-pool removes idleListener on acquire), so `pool.on("error")` doesn't help and plain Node exits. Fix: `pool.on("connect", c => c.on("error", log))`. Seen feat/db-tuning (2026-10-03).
- Role defaults (`ALTER ROLE ... SET`) hit EVERY later session, incl. the migration client's `pg_advisory_lock` wait (lock_timeout applies to advisory locks). Startup `options` must override each one. Tests on a fresh scratch DB miss it: the first login predates the migration.
