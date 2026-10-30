// Deletes auth records nobody can use any more. Safe to run twice: each statement only removes
// rows already past their end. Called by the app's daily maintenance job.
import { getDb } from "@__NAME__/db";
import { AUTH_DB_SCHEMA, INVITATION_RETENTION_DAYS } from "./config.ts";

export type AuthCleanupResult = {
  sessions: number;
  verifications: number;
  invitations: number;
};

export async function deleteExpiredAuthRecords(): Promise<AuthCleanupResult> {
  const client = getDb().$client;
  const sessions = await client.query(
    `delete from ${AUTH_DB_SCHEMA}.session where expires_at < now()`,
  );
  const verifications = await client.query(
    `delete from ${AUTH_DB_SCHEMA}.verification where expires_at < now()`,
  );
  // Kept a while after expiry so an owner can still see "expired" before it disappears.
  const invitations = await client.query(
    `delete from ${AUTH_DB_SCHEMA}.invitation
      where expires_at < now() - make_interval(days => $1)`,
    [INVITATION_RETENTION_DAYS],
  );
  return {
    sessions: sessions.rowCount ?? 0,
    verifications: verifications.rowCount ?? 0,
    invitations: invitations.rowCount ?? 0,
  };
}
