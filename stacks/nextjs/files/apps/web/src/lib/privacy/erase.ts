import { getDb } from "@__NAME__/db";
import { posthogHosts } from "../observability/posthog-hosts.ts";
import { CONSENT_IDENTITY_PROVIDER, POSTHOG_ERASE_ENV } from "./config.ts";

// Erasure (UK GDPR Art. 17) for systems Better Auth's own delete doesn't reach. Run by the
// `privacy-erase` job after an account is deleted; every step is safe to run twice.

export type ConsentEraseResult = { subjects: number; records: number };

// Consent subjects linked to the account, with their consent records and c15t's audit entries.
export async function eraseConsentSubjects(
  userId: string,
): Promise<ConsentEraseResult> {
  const client = await getDb().$client.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(
      `select id from consent.subject where "externalId" = $1 for update`,
      [userId],
    );
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) {
      await client.query("commit");
      return { subjects: 0, records: 0 };
    }
    await client.query(
      `delete from consent."auditLog" where "subjectId" = any($1::text[])`,
      [ids],
    );
    const records = await client.query(
      `delete from consent.consent where "subjectId" = any($1::text[])`,
      [ids],
    );
    await client.query(
      `delete from consent.subject where id = any($1::text[])`,
      [ids],
    );
    await client.query("commit");
    return { subjects: ids.length, records: records.rowCount ?? 0 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export type PostHogEraseResult = "deleted" | "not-configured";

// A hung PostHog call must not hold the job runner (its function has a time limit).
const POSTHOG_TIMEOUT_MS = 15_000;

export class PostHogEraseError extends Error {
  override name = "PostHogEraseError";
}

type BulkDeleteResponse = {
  deletion_errors?: unknown[];
};

// Deletes the PostHog person (distinct id = user id, see identifyUser) with their events and
// recordings. Queued deletion: PostHog removes them in the background within minutes. Throws on
// any failure so the job retries; returns `not-configured` when no personal API key is set.
export async function erasePostHogPerson(
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PostHogEraseResult> {
  const apiKey = process.env[POSTHOG_ERASE_ENV.personalApiKey];
  const projectId = process.env[POSTHOG_ERASE_ENV.projectId];
  if (!apiKey || !projectId) return "not-configured";
  const url = new URL(
    `/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
    posthogHosts().ui,
  );
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      distinct_ids: [userId],
      delete_events: true,
      delete_recordings: true,
    }),
    signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new PostHogEraseError(`PostHog answered ${response.status}`);
  }
  // Queued deletions can answer 202 with no body; only a JSON body can report errors.
  const text = await response.text();
  const body = text ? (JSON.parse(text) as BulkDeleteResponse) : {};
  if (body.deletion_errors?.length) {
    throw new PostHogEraseError("PostHog reported deletion errors");
  }
  return "deleted";
}

// Accounts erased per daily sweep; the rest wait for the next run.
const ORPHAN_SWEEP_LIMIT = 100;

// Safety net for erasure jobs that were never queued or gave up: consent subjects we linked to
// an account that no longer exists are erased by the daily consent-retention job.
export async function eraseOrphanedConsentSubjects(): Promise<number> {
  const { rows } = await getDb().$client.query<{ user_id: string }>(
    `select distinct s."externalId" as user_id
       from consent.subject s
      where s."identityProvider" = $1
        and s."externalId" is not null
        and not exists (select 1 from auth."user" u where u.id::text = s."externalId")
      limit $2`,
    [CONSENT_IDENTITY_PROVIDER, ORPHAN_SWEEP_LIMIT],
  );
  let erased = 0;
  for (const row of rows) {
    erased += (await eraseConsentSubjects(row.user_id)).subjects;
  }
  return erased;
}
