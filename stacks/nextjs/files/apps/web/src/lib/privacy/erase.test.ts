import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, describe, test } from "node:test";
import { closeDb, getDb } from "@__NAME__/db";
import { POSTHOG_ERASE_ENV } from "./config.ts";
import { linkConsentSubject } from "./consent-link.ts";
import {
  eraseConsentSubjects,
  eraseOrphanedConsentSubjects,
  erasePostHogPerson,
  PostHogEraseError,
} from "./erase.ts";

describe("erasePostHogPerson", () => {
  afterEach(() => {
    delete process.env[POSTHOG_ERASE_ENV.personalApiKey];
    delete process.env[POSTHOG_ERASE_ENV.projectId];
  });

  test("should skip without a personal API key", async () => {
    let called = false;
    const result = await erasePostHogPerson("user-1", async () => {
      called = true;
      return new Response();
    });
    assert.equal(result, "not-configured");
    assert.equal(called, false);
  });

  test("should bulk-delete the person with events, and throw on failures so the job retries", async () => {
    process.env[POSTHOG_ERASE_ENV.personalApiKey] = "phx_test";
    process.env[POSTHOG_ERASE_ENV.projectId] = "42";
    const requests: Array<{ url: string; body: unknown; auth: string | null }> =
      [];
    const respond = (status: number, body: unknown) =>
      (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
          auth: new Headers(init?.headers).get("authorization"),
        });
        return Response.json(body, { status });
      }) as typeof fetch;

    assert.equal(
      await erasePostHogPerson("user-1", respond(202, { deletion_errors: [] })),
      "deleted",
    );
    assert.match(
      requests[0]?.url ?? "",
      /\/api\/projects\/42\/persons\/bulk_delete\/$/,
    );
    assert.equal(requests[0]?.auth, "Bearer phx_test");
    assert.deepEqual(requests[0]?.body, {
      distinct_ids: ["user-1"],
      delete_events: true,
      delete_recordings: true,
    });
    const emptyAccepted = (async () =>
      new Response(null, { status: 202 })) as typeof fetch;
    assert.equal(await erasePostHogPerson("user-1", emptyAccepted), "deleted");
    await assert.rejects(
      erasePostHogPerson("user-1", respond(503, {})),
      PostHogEraseError,
    );
    await assert.rejects(
      erasePostHogPerson(
        "user-1",
        respond(202, { deletion_errors: [{ person_uuid: "x" }] }),
      ),
      PostHogEraseError,
    );
  });
});

// Integration: needs a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";

describe("consent linking and erasure", { skip }, () => {
  const subjectIds: string[] = [];

  after(async () => {
    const client = getDb().$client;
    await client.query(
      `delete from consent.subject where id = any($1::text[])`,
      [subjectIds],
    );
    await closeDb();
  });

  async function createSubject(): Promise<string> {
    const id = `sub_${randomUUID()
      .replaceAll("-", "")
      .replace(/[0OIl]/g, "x")}`;
    subjectIds.push(id);
    await getDb().$client.query(
      `insert into consent.subject (id) values ($1)`,
      [id],
    );
    return id;
  }

  test("should link only unlinked subjects with a well-formed id", async () => {
    const subjectId = await createSubject();
    const first = randomUUID();
    assert.equal(await linkConsentSubject(first, subjectId), "linked");
    assert.equal(await linkConsentSubject(first, subjectId), "already-yours");
    assert.equal(
      await linkConsentSubject(randomUUID(), subjectId),
      "other-account",
      "an already linked subject is never claimed by another account",
    );
    assert.equal(await linkConsentSubject(first, "sub_x'; drop"), "ignored");
  });

  test("should erase linked subjects, and sweep those whose account is gone", async () => {
    const userId = randomUUID();
    const subjectId = await createSubject();
    await linkConsentSubject(userId, subjectId);
    assert.deepEqual(await eraseConsentSubjects(userId), {
      subjects: 1,
      records: 0,
    });
    assert.deepEqual(await eraseConsentSubjects(userId), {
      subjects: 0,
      records: 0,
    });

    const orphan = await createSubject();
    await linkConsentSubject(randomUUID(), orphan);
    assert.ok((await eraseOrphanedConsentSubjects()) >= 1);
    const { rows } = await getDb().$client.query(
      `select 1 from consent.subject where id = $1`,
      [orphan],
    );
    assert.equal(rows.length, 0);
  });
});
