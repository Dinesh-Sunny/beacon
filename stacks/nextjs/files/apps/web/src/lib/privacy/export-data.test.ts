import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { closeDb, getDb, recordAuditEvent } from "@__NAME__/db";
import { buildDataExport } from "./export-data.ts";

// Integration: needs a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const RUN = randomUUID().slice(0, 8);

describe("buildDataExport", { skip }, () => {
  after(async () => {
    await getDb().$client.query(`delete from auth."user" where email = $1`, [
      `export-${RUN}@privacy.test`,
    ]);
    await closeDb();
  });

  test("should include the person's records and never a secret", async () => {
    const client = getDb().$client;
    const userId = randomUUID();
    const secrets = {
      password: `hash-${randomUUID()}`,
      accessToken: `access-${randomUUID()}`,
      sessionToken: `session-${randomUUID()}`,
    };
    await client.query(
      `insert into auth."user" (id, name, email, email_verified) values ($1, 'Ada', $2, true)`,
      [userId, `export-${RUN}@privacy.test`],
    );
    await client.query(
      `insert into auth.account (account_id, provider_id, user_id, password, access_token, created_at, updated_at)
       values ($1::text, 'credential', $1::uuid, $2, $3, now(), now())`,
      [userId, secrets.password, secrets.accessToken],
    );
    await client.query(
      `insert into auth.session (token, user_id, expires_at, ip_address, user_agent, created_at, updated_at)
       values ($1, $2, now() + interval '1 day', '203.0.113.7', 'Test agent', now(), now())`,
      [secrets.sessionToken, userId],
    );
    await recordAuditEvent(client, {
      action: "user.signed_in",
      actorId: userId,
    });

    const data = await buildDataExport(userId, "__NAME__");
    const json = JSON.stringify(data);
    for (const secret of Object.values(secrets)) {
      assert.ok(!json.includes(secret), "export must not contain secrets");
    }
    assert.equal(data.profile?.email, `export-${RUN}@privacy.test`);
    assert.equal(data.signInMethods.rows.length, 1);
    assert.equal(data.sessions.truncated, false);
    assert.equal(data.sessions.rows[0]?.ip_address, "203.0.113.7");
    assert.equal(data.activity.rows[0]?.action, "user.signed_in");
  });
});
