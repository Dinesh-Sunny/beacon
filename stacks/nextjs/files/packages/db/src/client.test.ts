import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { registerPool } from "./client.ts";
import { createScratchDatabase, type ScratchDatabase } from "./testing.ts";

const skip = process.env.DATABASE_URL_UNPOOLED
  ? false
  : "DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

describe("registerPool", { skip }, () => {
  let scratch: ScratchDatabase | undefined;

  before(async () => {
    scratch = await createScratchDatabase();
  });

  after(async () => {
    await scratch?.drop();
  });

  test("should survive the server ending a checked-out client when its transaction idles", async () => {
    assert.ok(scratch);
    const pool = registerPool(
      new pg.Pool({ connectionString: scratch.url, max: 1 }),
    );
    try {
      const client = await pool.connect();
      // Listen for the close only: an extra 'error' listener would hide the crash under test.
      const closed = new Promise<void>((resolve) => client.on("end", resolve));
      await client.query("begin");
      await client.query(
        "select set_config('idle_in_transaction_session_timeout', '100ms', true)",
      );
      await closed;
      client.release(true);
      // The pool replaced the dead client; the process is still here to run this.
      const { rows } = await pool.query<{ one: number }>("select 1 as one");
      assert.deepEqual(rows, [{ one: 1 }]);
    } finally {
      await pool.end();
    }
  });
});
