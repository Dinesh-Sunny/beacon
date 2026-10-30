import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { APPLICATION_NAME, POOL_CONFIG } from "./config.ts";
import { pooledUrl } from "./env.ts";
import * as schema from "./schema/index.ts";

export type Database = NodePgDatabase<typeof schema> & { $client: pg.Pool };

type DbCache = { pool: pg.Pool; db: Database };

// One pool per process: survives dev hot reloads and module copies across route bundles.
const globalCache = globalThis as typeof globalThis & {
  __agencyDb?: DbCache;
};

// Every pg Pool in the app goes through here (ours and Payload's), so they all survive dropped
// idle clients and release connections before a Fluid Compute instance suspends.
export function registerPool(pool: pg.Pool): pg.Pool {
  // Idle clients can be dropped by the server (Neon suspends, PgBouncer restarts). Without a
  // listener pg rethrows and crashes the process; the pool replaces the client on next checkout.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });
  // A checked-out client has no pool listener (pg-pool removes it during checkout), so a server-side
  // FATAL then, e.g. idle_in_transaction_session_timeout or transaction_timeout ending a transaction
  // a request left open, would be an unhandled 'error' event and crash the process. The failing
  // query still rejects, and the pool discards the dead client when it's released.
  pool.on("connect", (client) => {
    client.on("error", (error) => {
      console.error("[db] checked-out client error", error);
    });
  });
  // No-op outside Vercel.
  attachDatabasePool(pool);
  return pool;
}

function createCache(): DbCache {
  const pool = registerPool(
    new pg.Pool({
      connectionString: pooledUrl(),
      ...POOL_CONFIG,
      application_name: APPLICATION_NAME.web,
    }),
  );
  return { pool, db: drizzle({ client: pool, schema, casing: "snake_case" }) };
}

function cache(): DbCache {
  globalCache.__agencyDb ??= createCache();
  return globalCache.__agencyDb;
}

// Lazy so importing this module (e.g. during `next build`) never needs DATABASE_URL.
export function getDb(): Database {
  return cache().db;
}

export async function closeDb(): Promise<void> {
  const current = globalCache.__agencyDb;
  globalCache.__agencyDb = undefined;
  await current?.pool.end();
}
