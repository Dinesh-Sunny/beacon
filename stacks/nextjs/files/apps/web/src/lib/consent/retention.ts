import { deleteInBatches, getDb } from "@__NAME__/db";
import { CONSENT_EXPIRY_DAYS, CONSENT_RETENTION_YEARS } from "./config.ts";

// Rows per delete, so one run never holds a long lock on a large table.
const BATCH_SIZE = 1000;
// Batches per run; anything left waits for tomorrow's run. The cutoff isn't indexable (it falls
// back to givenAt), so each batch scans the table: fine at template sizes, revisit if it grows.
const MAX_BATCHES = 50;

// Deletes consent records past their retention: the choice's end (validUntil, or givenAt plus
// the choice lifetime for rows without one) plus CONSENT_RETENTION_YEARS. Safe to run twice.
export async function deleteExpiredConsentRecords(): Promise<number> {
  return deleteInBatches(
    getDb().$client,
    `delete from consent.consent where id in (
       select id from consent.consent
        where coalesce("validUntil", "givenAt" + make_interval(days => $1))
              < now() - make_interval(years => $2)
        limit $3)`,
    [CONSENT_EXPIRY_DAYS, CONSENT_RETENTION_YEARS],
    { batchSize: BATCH_SIZE, maxBatches: MAX_BATCHES },
  );
}
