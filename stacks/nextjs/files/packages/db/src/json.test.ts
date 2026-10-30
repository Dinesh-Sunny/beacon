import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { asc, type SQL, sql } from "drizzle-orm";
import { integer, jsonb, PgDialect, pgTable } from "drizzle-orm/pg-core";
import type { Database } from "./client.ts";
import {
  type JsonValue,
  jsonContains,
  jsonHasKey,
  jsonPathExists,
  jsonText,
} from "./json.ts";
import { createScratchDatabase, type ScratchDatabase } from "./testing.ts";

const skip = process.env.DATABASE_URL_UNPOOLED
  ? false
  : "DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

// Test-only table, created by hand in the scratch database below.
const docs = pgTable("test_docs", {
  id: integer().primaryKey(),
  data: jsonb().$type<JsonValue>().notNull(),
});

const DOCS: { id: number; data: JsonValue }[] = [
  { id: 1, data: { kind: "shirt", tags: ["red", "sale"], size: { eu: 40 } } },
  { id: 2, data: { kind: "shirt", tags: ["blue"], size: { eu: 42 } } },
  { id: 3, data: { kind: "hat", tags: ["red"], note: null } },
];

const dialect = new PgDialect();
// Would break out of a string literal if a helper ever spliced values into SQL.
const HOSTILE = "x' or true --";

describe("jsonb helpers (SQL)", () => {
  test("should bind arrays as one JSON parameter when checking containment", () => {
    const query = dialect.sqlToQuery(
      jsonContains(docs.data, { tags: ["a", "b"] }),
    );
    assert.deepEqual(query.params, ['{"tags":["a","b"]}']);
  });

  test("should bind a key path as one text[] parameter when reading text", () => {
    const query = dialect.sqlToQuery(jsonText(docs.data, "size", "eu"));
    assert.match(query.sql, /#>> \$1::text\[\]$/);
    assert.deepEqual(query.params, [["size", "eu"]]);
  });

  test("should bind the key when checking a key exists", () => {
    const query = dialect.sqlToQuery(jsonHasKey(docs.data, HOSTILE));
    assert.doesNotMatch(query.sql, /or true/);
    assert.deepEqual(query.params, [HOSTILE]);
  });

  test("should bind the path and variables when matching a jsonpath", () => {
    const query = dialect.sqlToQuery(
      jsonPathExists(docs.data, "$.tags[*] ? (@ == $tag)", { tag: HOSTILE }),
    );
    assert.doesNotMatch(query.sql, /or true/);
    assert.deepEqual(query.params, [
      "$.tags[*] ? (@ == $tag)",
      JSON.stringify({ tag: HOSTILE }),
    ]);
  });
});

describe("jsonb helpers (database)", { skip }, () => {
  let scratch: ScratchDatabase | undefined;
  let db: Database;

  const ids = async (where: SQL): Promise<number[]> =>
    (
      await db
        .select({ id: docs.id })
        .from(docs)
        .where(where)
        .orderBy(asc(docs.id))
    ).map((row) => row.id);

  before(async () => {
    scratch = await createScratchDatabase();
    db = scratch.db;
    await scratch.pool.query(`
      create table test_docs (id integer primary key, data jsonb not null);
      create index test_docs_data_gin on test_docs using gin (data jsonb_path_ops);
    `);
    await db.insert(docs).values(DOCS);
  });

  after(async () => {
    await scratch?.drop();
  });

  test("should match documents when they contain a fragment with an array", async () => {
    assert.deepEqual(
      await ids(jsonContains(docs.data, { tags: ["red"] })),
      [1, 3],
    );
  });

  test("should match documents when the top-level key exists", async () => {
    assert.deepEqual(await ids(jsonHasKey(docs.data, "note")), [3]);
  });

  test("should match documents when a static jsonpath holds", async () => {
    assert.deepEqual(
      await ids(jsonPathExists(docs.data, "$.size.eu ? (@ > 41)")),
      [2],
    );
  });

  test("should match documents when user values travel as jsonpath variables", async () => {
    assert.deepEqual(
      await ids(
        jsonPathExists(docs.data, "$.tags[*] ? (@ == $tag)", { tag: "blue" }),
      ),
      [2],
    );
  });

  test("should skip documents the path can't evaluate when variables are given", async () => {
    // Doc 3 has no `size`: strict mode raises there unless the call is silent like `@?`.
    assert.deepEqual(
      await ids(
        jsonPathExists(docs.data, "strict $.size.eu ? (@ > $min)", { min: 41 }),
      ),
      [2],
    );
  });

  test("should return text when the path exists and NULL when it is missing", async () => {
    const rows = await db
      .select({ id: docs.id, eu: jsonText(docs.data, "size", "eu") })
      .from(docs)
      .orderBy(asc(docs.id));
    assert.deepEqual(rows, [
      { id: 1, eu: "40" },
      { id: 2, eu: "42" },
      { id: 3, eu: null },
    ]);
  });

  test("should use the GIN index when filtering by containment", async () => {
    const plan = await db.transaction(async (tx) => {
      // Three rows would always seq scan; force the planner to show whether the index applies.
      await tx.execute(sql`set local enable_seqscan = off`);
      const result = await tx.execute<{ "QUERY PLAN": string }>(
        sql`explain ${db
          .select()
          .from(docs)
          .where(jsonContains(docs.data, { kind: "hat" }))}`,
      );
      return result.rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
    assert.match(plan, /Bitmap Index Scan on test_docs_data_gin/);
  });
});
