import { getDb } from "@__NAME__/db";
import {
  CONSENT_IDENTITY_PROVIDER,
  CONSENT_SUBJECT_ID_PATTERN,
} from "./config.ts";

export type ConsentLinkResult =
  | "linked"
  | "already-yours"
  | "other-account"
  | "ignored";

// Links this browser's consent subject to the signed-in account, so a data export finds the
// person's consent records and erasure deletes them. The id comes from the browser (c15t keeps it
// client-side), so only an unlinked subject is ever claimed. A subject already linked to someone
// else means a shared browser: the caller starts a fresh subject instead (ConsentIdentity), so
// one person's choices never land in another's export or erasure. Ids carry 96 random bits.
export async function linkConsentSubject(
  userId: string,
  subjectId: string,
): Promise<ConsentLinkResult> {
  if (!CONSENT_SUBJECT_ID_PATTERN.test(subjectId)) return "ignored";
  const client = getDb().$client;
  const linked = await client.query(
    `update consent.subject
        set "externalId" = $1, "identityProvider" = $2, "updatedAt" = now()
      where id = $3 and "externalId" is null`,
    [userId, CONSENT_IDENTITY_PROVIDER, subjectId],
  );
  if ((linked.rowCount ?? 0) > 0) return "linked";
  const { rows } = await client.query<{ externalId: string | null }>(
    `select "externalId" from consent.subject where id = $1`,
    [subjectId],
  );
  const owner = rows[0]?.externalId;
  if (owner === undefined || owner === null) return "ignored";
  return owner === userId ? "already-yours" : "other-account";
}
