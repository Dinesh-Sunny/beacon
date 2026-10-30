import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { closeDb, getDb } from "@__NAME__/db";
import { deleteExpiredAgentThreads } from "./agent-retention.ts";

// Integration: needs a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const RUN = randomUUID().slice(0, 8);

describe("agent thread retention", { skip }, () => {
  after(async () => {
    const client = getDb().$client;
    await client.query(`delete from auth."user" where email like $1`, [
      `%-${RUN}@retention.test`,
    ]);
    await closeDb();
  });

  test("should delete idle threads and orphaned state and keep recent ones", async () => {
    const client = getDb().$client;
    const { rows } = await client.query<{ id: string }>(
      `insert into auth."user" (name, email) values ('r', $1) returning id`,
      [`owner-${RUN}@retention.test`],
    );
    const userId = rows[0]?.id;
    assert.ok(userId);
    const [idle, recent, orphan] = ["idle", "recent", "orphan"].map(
      (name) => `${name}-${RUN}`,
    );
    await client.query(
      `insert into agent_threads (id, user_id, agent, updated_at) values
         ($1, $3, 'demo', now() - interval '1 year'), ($2, $3, 'demo', now())`,
      [idle, recent, userId],
    );
    for (const thread of [idle, recent, orphan]) {
      await client.query(
        `insert into checkpoints (thread_id, checkpoint_id, checkpoint) values ($1, 'c1', '{}')`,
        [thread],
      );
    }
    await deleteExpiredAgentThreads();
    const { rows: left } = await client.query<{ thread_id: string }>(
      "select thread_id from checkpoints where thread_id = any($1::text[]) order by thread_id",
      [[idle, recent, orphan]],
    );
    assert.deepEqual(
      left.map((row) => row.thread_id),
      [recent],
    );
    await client.query("delete from checkpoints where thread_id = $1", [
      recent,
    ]);
  });
});
