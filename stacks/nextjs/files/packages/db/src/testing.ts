// Test support: a throwaway database migrated like production, so integration tests never touch
// the dev database. Imported only by *.test.ts files.
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Database } from "./client.ts";
import { directUrl } from "./env.ts";
import { runMigrations } from "./migrate.ts";
import * as schema from "./schema/index.ts";

export type ScratchDatabase = {
  url: string;
  db: Database;
  pool: pg.Pool;
  drop: () => Promise<void>;
};

async function admin(query: string): Promise<void> {
  const client = new pg.Client({ connectionString: directUrl() });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

// One connection by default, so a setting that leaked past its transaction shows on the next query.
export async function createScratchDatabase(
  poolMax = 1,
): Promise<ScratchDatabase> {
  const name = `__PYNAME___test_${randomUUID().replaceAll("-", "")}`;
  const dropDatabase = () =>
    admin(`drop database if exists ${name} with (force)`);
  await admin(`create database ${name}`);
  const url = new URL(directUrl());
  url.pathname = `/${name}`;
  try {
    await runMigrations(url.toString());
  } catch (error) {
    // No handle reaches the caller on failure, so clean up here or the database is left behind.
    await dropDatabase();
    throw error;
  }
  const pool = new pg.Pool({ connectionString: url.toString(), max: poolMax });
  return {
    url: url.toString(),
    db: drizzle({ client: pool, schema, casing: "snake_case" }),
    pool,
    drop: async () => {
      await pool.end();
      await dropDatabase();
    },
  };
}
