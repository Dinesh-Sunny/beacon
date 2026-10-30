// Single source of truth for database settings shared by the client, migrations, and drizzle-kit.

// Names match what Neon's Vercel integration injects, so every provider uses the same two variables.
// Pooled (PgBouncer, transaction mode): app queries. Direct: migrations, DDL, session features.
export const DATABASE_URL_ENV = "DATABASE_URL";
export const DATABASE_URL_UNPOOLED_ENV = "DATABASE_URL_UNPOOLED";

// Recycle connections hourly: PlanetScale asks for a lifetime under 24 h so failovers and
// parameter restarts don't strand clients, and recycling also picks up changed role defaults.
// TCP keepalive notices connections dropped while a Fluid instance is suspended.
export const CONNECTION_LIFECYCLE = {
  maxLifetimeSeconds: 3_600,
  keepAlive: true,
} as const;

// Vercel Fluid Compute guidance: keep one warm connection, allow concurrency, close idle ones fast.
// https://vercel.com/kb/guide/connection-pooling-with-functions
export const POOL_CONFIG = {
  min: 1,
  max: 10,
  idleTimeoutMillis: 5_000,
  // node-pg waits forever by default; fail fast so health checks return 503 instead of hanging.
  connectionTimeoutMillis: 5_000,
  ...CONNECTION_LIFECYCLE,
} as const;

// Pooled connections must not send other startup parameters (PgBouncer rejects them), but
// application_name is one PgBouncer tracks, so every pool tags its connections for pg_stat_activity
// and query stats.
export const APPLICATION_NAME = {
  web: "__NAME__-web",
  payload: "__NAME__-payload",
  migrate: "__NAME__-migrate",
} as const;

// Server-side timeouts for the app role, set per database by migration 0014 (the only way that
// works through both poolers). Room for Payload's transactions, which wrap hooks such as emails
// and revalidation; still bounds a stuck query or a transaction left open. db.test.ts checks the
// migrated values match these. Written the way Postgres reports them (`1min`, not `60s`).
export const ROLE_TIMEOUTS = {
  statement_timeout: "15s",
  lock_timeout: "5s",
  idle_in_transaction_session_timeout: "30s",
  transaction_timeout: "1min",
} as const;

// Migrations run on the direct URL (startup options allowed) and may be long, so they lift the
// role timeouts for their session. lock_timeout is set after the migration lock is held: DDL that
// can't get its lock fails the deploy instead of queueing every app query behind it.
const MIGRATION_TIMEOUTS_OFF =
  "-c statement_timeout=0 -c transaction_timeout=0 -c idle_in_transaction_session_timeout=0";
export const MIGRATION_LOCK_TIMEOUT = "10s";
// The lock-holding session: lock_timeout 0 too, or the role's 5 s would apply to waiting for
// another deploy's migration lock. withMigrationLock sets MIGRATION_LOCK_TIMEOUT once it holds it.
export const MIGRATION_SESSION_OPTIONS = `${MIGRATION_TIMEOUTS_OFF} -c lock_timeout=0`;
// For migrators that take no advisory lock first (Payload's pool while PAYLOAD_MIGRATING).
export const MIGRATION_DDL_OPTIONS = `${MIGRATION_TIMEOUTS_OFF} -c lock_timeout=${MIGRATION_LOCK_TIMEOUT}`;

// Retention and cleanup deletes run in chunks (batch.ts) so each statement stays well inside
// ROLE_TIMEOUTS.statement_timeout and holds row locks briefly. Rows left after maxBatches wait for
// the next run.
export const DELETE_BATCH = {
  batchSize: 1_000,
  maxBatches: 50,
} as const;

// Deploy builds migrate only where this is "1". Set it on Production and on Preview only when
// previews get their own database branch, so an unmerged migration never reaches production.
export const MIGRATE_ON_BUILD_ENV = "DB_MIGRATE_ON_BUILD";

// Session advisory lock held while migrating so concurrent deploys apply migrations one at a time
// (neither drizzle nor Payload locks). Any constant works; it only has to be the same everywhere.
export const MIGRATION_LOCK_KEY = 72_431_001;

// Graph walks (graph.ts). Cost grows with depth times the edges reachable at each level, so depth is
// capped and every walk runs under its own statement timeout. Raise only after EXPLAIN ANALYZE on
// production-sized data.
export const GRAPH_WALK = {
  defaultDepth: 3,
  maxDepth: 6,
  maxRows: 1_000,
  timeoutMs: 2_000,
} as const;

// SQLSTATE codes mapped to typed errors (https://www.postgresql.org/docs/current/errcodes-appendix.html).
export const PG_ERROR = {
  queryCanceled: "57014",
  invalidTextRepresentation: "22P02",
} as const;

// ltree labels: letters, digits, `_` and `-`, at most 1000 characters (Postgres 16+, C locale).
export const LTREE_LABEL = /^[A-Za-z0-9_-]{1,1000}$/;

// Relative to the package root. Resolved only in migrate.ts so app bundles never reference it.
export const MIGRATIONS_DIR = "migrations";

// Audit log (migration 0015, audit.ts): events are kept 13 full months (a year plus the month of
// an annual review), then their partition is dropped. Partitions are created this many months ahead.
export const AUDIT_RETENTION_MONTHS = 13;
export const AUDIT_PARTITIONS_AHEAD = 3;
