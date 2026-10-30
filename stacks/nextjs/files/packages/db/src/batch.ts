import type pg from "pg";
import { DELETE_BATCH } from "./config.ts";

export type BatchLimits = { batchSize: number; maxBatches: number };

// Runs a delete in chunks until a chunk comes back short or maxBatches is reached. `sqlText` picks
// its rows with a subquery ending in `limit $N`, where $N is one past `params` (the batch size is
// appended), e.g. `delete from t where ctid in (select ctid from t where ... limit $1)`.
// One unbatched delete is all-or-nothing: once the backlog outgrows statement_timeout, every run
// fails and nothing is ever removed.
export async function deleteInBatches(
  client: Pick<pg.Pool, "query">,
  sqlText: string,
  params: readonly unknown[] = [],
  limits: BatchLimits = DELETE_BATCH,
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < limits.maxBatches; batch++) {
    const result = await client.query(sqlText, [...params, limits.batchSize]);
    const count = result.rowCount ?? 0;
    deleted += count;
    if (count < limits.batchSize) break;
  }
  return deleted;
}
