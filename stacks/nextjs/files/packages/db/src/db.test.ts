import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { closeDb } from "./client.ts";
import {
  MIGRATION_LOCK_TIMEOUT,
  MIGRATION_SESSION_OPTIONS,
  MIGRATIONS_DIR,
  ROLE_TIMEOUTS,
} from "./config.ts";
import { directUrl } from "./env.ts";
import { checkDatabase } from "./health.ts";
import { runMigrations, withMigrationLock } from "./migrate.ts";

// Integration tests: need a real Postgres (`pnpm db:up`). CI provides one, so they never skip there.
const skip =
  process.env.DATABASE_URL && process.env.DATABASE_URL_UNPOOLED
    ? false
    : "DATABASE_URL or DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

async function countMigrationFiles(): Promise<number> {
  const dir = path.resolve(import.meta.dirname, "..", MIGRATIONS_DIR);
  return (await readdir(dir)).filter((file) => file.endsWith(".sql")).length;
}

const REQUIRED_EXTENSIONS = [
  "btree_gin",
  "btree_gist",
  "ltree",
  "pg_trgm",
  "unaccent",
  "vector",
];

async function withClient<T>(
  connectionString: string,
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

describe("database", { skip }, () => {
  // A throwaway database created and removed by this suite only, so migrations really start
  // from empty and both runs race for the lock. The dev database is never touched.
  const scratchName = `__PYNAME___test_${randomUUID().replaceAll("-", "")}`;
  let scratchUrl = "";

  before(async () => {
    const url = new URL(directUrl());
    url.pathname = `/${scratchName}`;
    scratchUrl = url.toString();
    await withClient(directUrl(), (client) =>
      client.query(`create database ${scratchName}`),
    );
  });

  after(async () => {
    await closeDb();
    await withClient(directUrl(), (client) =>
      client.query(`drop database if exists ${scratchName} with (force)`),
    );
  });

  test("should apply each migration once when two runs start together", async () => {
    await Promise.all([runMigrations(scratchUrl), runMigrations(scratchUrl)]);

    await withClient(scratchUrl, async (client) => {
      const extensions = await client.query<{ extname: string }>(
        "select extname from pg_extension where extname = any($1) order by 1",
        [REQUIRED_EXTENSIONS],
      );
      assert.deepEqual(
        extensions.rows.map((row) => row.extname),
        REQUIRED_EXTENSIONS,
      );
      const applied = await client.query(
        "select 1 from drizzle.__drizzle_migrations",
      );
      assert.equal(applied.rowCount, await countMigrationFiles());
      const schemas = await client.query(
        "select 1 from pg_namespace where nspname = 'payload'",
      );
      assert.equal(schemas.rowCount, 1);
    });
  });

  test("should set the role timeouts from config when migrations run", async () => {
    await withClient(scratchUrl, async (client) => {
      const { rows } = await client.query<{ setconfig: string[] }>(
        `select s.setconfig from pg_db_role_setting s
         join pg_database d on d.oid = s.setdatabase
         where s.setrole = (select oid from pg_roles where rolname = current_user)
           and d.datname = current_database()`,
      );
      const applied = Object.fromEntries(
        (rows[0]?.setconfig ?? []).map((entry) => entry.split("=", 2)),
      );
      assert.deepEqual(applied, ROLE_TIMEOUTS);
    });
  });

  test("should start new sessions with the role timeouts when migrations have run", async () => {
    // A fresh login, as a pooler's server connection would make after migration 0014.
    await withClient(scratchUrl, async (client) => {
      for (const [name, value] of Object.entries(ROLE_TIMEOUTS)) {
        const { rows } = await client.query<{ setting: string }>(
          "select current_setting($1) as setting",
          [name],
        );
        assert.equal(rows[0]?.setting, value, name);
      }
    });
  });

  test("should lift the role timeouts and cap lock waits when migrating", async () => {
    const settings = await withMigrationLock(scratchUrl, async (client) => {
      const { rows } = await client.query<{ name: string; setting: string }>(
        `select name, current_setting(name) as setting from unnest($1::text[]) as name`,
        [[...Object.keys(ROLE_TIMEOUTS)]],
      );
      return Object.fromEntries(rows.map((row) => [row.name, row.setting]));
    });
    assert.deepEqual(settings, {
      statement_timeout: "0",
      lock_timeout: MIGRATION_LOCK_TIMEOUT,
      idle_in_transaction_session_timeout: "0",
      transaction_timeout: "0",
    });
  });

  test("should not apply the role lock timeout when a migration session starts", async () => {
    // The advisory lock wait must outlast another deploy's migration, so no 5 s role default here.
    const client = new pg.Client({
      connectionString: scratchUrl,
      options: MIGRATION_SESSION_OPTIONS,
    });
    await client.connect();
    try {
      const { rows } = await client.query<{ lock_timeout: string }>(
        "show lock_timeout",
      );
      assert.equal(rows[0]?.lock_timeout, "0");
    } finally {
      await client.end();
    }
  });

  test("should report healthy when the pooled URL is reachable", async () => {
    const health = await checkDatabase();
    assert.equal(health.ok, true);
  });
});
