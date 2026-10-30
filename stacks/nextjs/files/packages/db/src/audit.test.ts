import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import {
  listAuditEvents,
  maintainAuditPartitions,
  recordAuditEvent,
} from "./audit.ts";
import { createScratchDatabase, type ScratchDatabase } from "./testing.ts";

const skip = process.env.DATABASE_URL_UNPOOLED
  ? false
  : "DATABASE_URL_UNPOOLED not set (run `pnpm db:up`)";

describe("audit log", { skip }, () => {
  let scratch: ScratchDatabase;

  before(async () => {
    scratch = await createScratchDatabase();
  });

  after(async () => {
    await scratch?.drop();
  });

  async function partitions(): Promise<string[]> {
    const { rows } = await scratch.pool.query<{ relname: string }>(
      `select c.relname from pg_inherits i
         join pg_class c on c.oid = i.inhrelid
         join pg_class p on p.oid = i.inhparent
        where p.relname = 'events' order by 1`,
    );
    return rows.map((row) => row.relname);
  }

  test("should refuse to update, delete, or truncate recorded events", async () => {
    await recordAuditEvent(scratch.pool, {
      action: "user.signed_in",
      actorId: randomUUID(),
    });
    for (const sql of [
      "update audit.events set action = 'x'",
      "delete from audit.events",
      "truncate audit.events",
      "truncate audit.events_default",
    ]) {
      await assert.rejects(scratch.pool.query(sql), /append-only/, sql);
    }
  });

  test("should list an organization's events newest first, a page at a time, by category", async () => {
    const organizationId = randomUUID();
    const actorId = randomUUID();
    for (const action of [
      "member.added",
      "api_key.created",
      "member.role_changed",
    ] as const) {
      await recordAuditEvent(scratch.pool, {
        action,
        actorId,
        organizationId,
        target: { type: "member", id: randomUUID() },
        metadata: { role: "admin" },
      });
    }
    await recordAuditEvent(scratch.pool, {
      action: "member.added",
      organizationId: randomUUID(),
    });

    const first = await listAuditEvents(
      scratch.pool,
      { organizationId },
      { limit: 2 },
    );
    assert.deepEqual(
      first.events.map((event) => event.action),
      ["member.role_changed", "api_key.created"],
    );
    assert.ok(first.next);
    const second = await listAuditEvents(
      scratch.pool,
      { organizationId },
      { limit: 2, cursor: first.next },
    );
    assert.deepEqual(
      second.events.map((event) => event.action),
      ["member.added"],
    );
    assert.equal(second.next, null);

    const members = await listAuditEvents(
      scratch.pool,
      { organizationId },
      { limit: 10, category: "members" },
    );
    assert.equal(members.events.length, 2);
    assert.equal(members.events[0]?.metadata.role, "admin");
  });

  test("should create partitions ahead and drop those past retention", async () => {
    const now = new Date("2030-06-15T12:00:00Z");
    const first = await maintainAuditPartitions(scratch.pool, now);
    assert.equal(first.created, 4);
    const again = await maintainAuditPartitions(scratch.pool, now);
    assert.equal(again.created, 0, "running twice creates nothing new");
    assert.ok((await partitions()).includes("events_2030_09"));

    // Fourteen months later the June 2030 partition is past 13 months of retention. A session
    // time zone west of UTC must not move the cutoff.
    await scratch.pool.query("set timezone = 'America/New_York'");
    const later = await maintainAuditPartitions(
      scratch.pool,
      new Date("2031-08-02T00:00:00Z"),
    );
    assert.ok(later.dropped >= 1);
    const left = await partitions();
    assert.ok(!left.includes("events_2030_06"));
    assert.ok(left.includes("events_2030_07"));
    await scratch.pool.query("reset timezone");
  });

  test("should move rows caught by the default partition into a new month", async () => {
    await recordAuditEvent(scratch.pool, { action: "user.signed_in" });
    await scratch.pool.query(
      "insert into audit.events (action, occurred_at) values ('user.signed_in', '2040-03-10T00:00:00Z')",
    );
    await maintainAuditPartitions(
      scratch.pool,
      new Date("2040-03-01T00:00:00Z"),
    );
    const { rows } = await scratch.pool.query<{ partition: string }>(
      "select tableoid::regclass::text as partition from audit.events where occurred_at = '2040-03-10T00:00:00Z'",
    );
    assert.equal(rows[0]?.partition, "audit.events_2040_03");
  });
});
