import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import {
  APPLICATION_NAME,
  MIGRATE_ON_BUILD_ENV,
  MIGRATION_LOCK_KEY,
  MIGRATION_LOCK_TIMEOUT,
  MIGRATION_SESSION_OPTIONS,
  MIGRATIONS_DIR,
} from "./config.ts";

const MIGRATIONS_FOLDER = path.resolve(
  import.meta.dirname,
  "..",
  MIGRATIONS_DIR,
);

// Runs `run` while holding a session advisory lock on a direct (unpooled) connection, so
// concurrent deploys migrate one at a time. PgBouncer transaction mode has no real session,
// which is why this must not use the pooled URL. Other migrators (Payload) run inside `run` on
// their own connections; the lock only has to be held, not shared.
export async function withMigrationLock<T>(
  connectionString: string,
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({
    connectionString,
    application_name: APPLICATION_NAME.migrate,
    // Lifts the app role's timeouts (config.ts): migrations can be long.
    options: MIGRATION_SESSION_OPTIONS,
  });
  // Warnings raised by migrations (e.g. 0013 when pg_stat_statements isn't enabled yet) arrive as
  // notices; without a listener node-pg drops them and the deploy log never shows them.
  // Plain NOTICEs (Drizzle's "already exists, skipping") stay quiet.
  client.on("notice", (notice) => {
    if (notice.severity !== "NOTICE") console.warn("[db]", notice.message);
  });
  await client.connect();
  try {
    // Waits as long as another deploy holds the lock; lock_timeout comes only after.
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query("select set_config('lock_timeout', $1, false)", [
      MIGRATION_LOCK_TIMEOUT,
    ]);
    try {
      return await run(client);
    } finally {
      // If the connection died mid-migration this fails too; keep the original error visible.
      // Session locks are released when the connection closes anyway.
      await client
        .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY])
        .catch((error: unknown) => {
          console.error("[db] could not release migration lock", error);
        });
    }
  } finally {
    await client.end();
  }
}

// Applies this package's Drizzle migrations on an already-connected client.
export async function migrateDrizzle(client: pg.Client): Promise<void> {
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
}

type Env = Readonly<Record<string, string | undefined>>;

// Deploy builds migrate only where DB_MIGRATE_ON_BUILD is "1": Production, and Previews that get
// their own database branch. Otherwise a PR's migration would reach the shared database.
export function isBuildMigrationEnabled(env: Env = process.env): boolean {
  return env[MIGRATE_ON_BUILD_ENV] === "1";
}

// Drizzle migrations only, under the lock. Apps with more migrators compose the two above.
export async function runMigrations(connectionString: string): Promise<void> {
  await withMigrationLock(connectionString, migrateDrizzle);
}
