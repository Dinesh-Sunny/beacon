-- btree_gin: lets one GIN index pair a scalar column with jsonb, arrays, or tsvector, e.g.
-- (organization_id, attributes jsonb_path_ops), so tenant-scoped document queries use one index.
-- Plain CREATE EXTENSION on local, Neon, and PlanetScale (docs/knowledge/database.md).
CREATE EXTENSION IF NOT EXISTS btree_gin;--> statement-breakpoint
-- pg_stat_statements: per-query timing and I/O. Observability only; nothing in the app depends on
-- it. Neon installs it on CREATE EXTENSION; PlanetScale needs it enabled in the dashboard first
-- (restart), and local Docker preloads it (compose.yaml). Where it can't be created yet, warn and
-- carry on rather than fail a deploy over a monitoring view. The EXCEPTION block runs as a
-- subtransaction, so a failure here doesn't abort the migration transaction.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_stat_statements not installed: %. Enable it for this database, then run CREATE EXTENSION pg_stat_statements.', SQLERRM;
END
$$;
