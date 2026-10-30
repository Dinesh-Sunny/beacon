import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { deleteInBatches } from "./batch.ts";
import { createScratchDatabase, type ScratchDatabase } from "./testing.ts";

const skip = process.env.DATABASE_URL_UNPOOLED
  ? false
  : "DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

// Deletes rows with the given parity, LIMIT rows at a time.
const DELETE_BY_PARITY = `delete from test_rows where ctid in (
  select ctid from test_rows where n % 2 = $1 limit $2)`;

describe("deleteInBatches", { skip }, () => {
  let scratch: ScratchDatabase | undefined;

  before(async () => {
    scratch = await createScratchDatabase();
    await scratch.pool.query("create table test_rows (n int)");
  });

  after(async () => {
    await scratch?.drop();
  });

  // 1..rows, so ceil(rows / 2) odd rows.
  const seed = async (rows: number) => {
    assert.ok(scratch);
    await scratch.pool.query("truncate test_rows");
    await scratch.pool.query(
      "insert into test_rows select generate_series(1, $1)",
      [rows],
    );
    return scratch.pool;
  };

  test("should delete every matching row when the backlog fits in maxBatches", async () => {
    const pool = await seed(25);
    const deleted = await deleteInBatches(pool, DELETE_BY_PARITY, [1], {
      batchSize: 4,
      maxBatches: 10,
    });
    assert.equal(deleted, 13);
    const { rows } = await pool.query<{ left: number }>(
      "select count(*)::int as left from test_rows where n % 2 = 1",
    );
    assert.equal(rows[0]?.left, 0);
  });

  test("should stop at maxBatches when the backlog is larger", async () => {
    const pool = await seed(25);
    const deleted = await deleteInBatches(pool, DELETE_BY_PARITY, [1], {
      batchSize: 4,
      maxBatches: 2,
    });
    assert.equal(deleted, 8);
  });
});
