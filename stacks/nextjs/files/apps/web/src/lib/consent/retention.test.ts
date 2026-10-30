import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { closeDb, getDb } from "@__NAME__/db";
import { deleteExpiredConsentRecords } from "./retention.ts";

// Integration: needs a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const RUN = randomUUID().slice(0, 8);

describe("consent retention", { skip }, () => {
  after(async () => {
    const client = getDb().$client;
    await client.query(`delete from consent.consent where "subjectId" = $1`, [
      `sub_${RUN}`,
    ]);
    await client.query("delete from consent.subject where id = $1", [
      `sub_${RUN}`,
    ]);
    await client.query("delete from consent.domain where id = $1", [
      `dom_${RUN}`,
    ]);
    await closeDb();
  });

  test("should delete records two years past their end and keep the rest", async () => {
    const client = getDb().$client;
    await client.query("insert into consent.subject (id) values ($1)", [
      `sub_${RUN}`,
    ]);
    await client.query(
      "insert into consent.domain (id, name) values ($1, 'localhost')",
      [`dom_${RUN}`],
    );
    await client.query(
      `insert into consent.consent (id, "subjectId", "domainId", "purposeIds", "givenAt", "validUntil") values
         ($1, $4, $5, '[]', now() - interval '3 years', now() - interval '3 years'),
         ($2, $4, $5, '[]', now() - interval '3 years', null),
         ($3, $4, $5, '[]', now(), now() + interval '182 days')`,
      [
        `old_${RUN}`,
        `oldnull_${RUN}`,
        `new_${RUN}`,
        `sub_${RUN}`,
        `dom_${RUN}`,
      ],
    );
    await deleteExpiredConsentRecords();
    const { rows } = await client.query<{ id: string }>(
      `select id from consent.consent where "subjectId" = $1`,
      [`sub_${RUN}`],
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      [`new_${RUN}`],
    );
  });
});
