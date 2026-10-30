import { deleteInBatches, getDb } from "@__NAME__/db";
import { AGENT_THREAD_RETENTION_DAYS } from "./agents.ts";

// LangGraph's checkpoint tables (packages/db migration 0009); keyed by thread_id, no timestamps.
const CHECKPOINT_TABLES = [
  "checkpoint_writes",
  "checkpoint_blobs",
  "checkpoints",
] as const;

export type AgentRetentionResult = { threads: number; orphans: number };

// Deletes whole conversations idle past the retention, and checkpoint state whose thread row is
// gone (its user was deleted, which cascades to agent_threads). Whole threads only: deleting part
// of a thread's checkpoints can leave LangGraph unable to rebuild its state. Safe to run twice.
// Batched (DELETE_BATCH in @__NAME__/db) so each statement stays inside the role's statement timeout;
// a backlog beyond one run's batches finishes on later runs.
export async function deleteExpiredAgentThreads(): Promise<AgentRetentionResult> {
  const client = getDb().$client;
  const threads = await deleteInBatches(
    client,
    `delete from agent_threads where id in (
       select id from agent_threads
        where updated_at < now() - make_interval(days => $1)
        limit $2)`,
    [AGENT_THREAD_RETENTION_DAYS],
  );
  let orphans = 0;
  for (const table of CHECKPOINT_TABLES) {
    const deleted = await deleteInBatches(
      client,
      `delete from ${table} where ctid in (
         select c.ctid from ${table} c
          where not exists (select 1 from agent_threads t where t.id = c.thread_id)
          limit $1)`,
    );
    if (table === "checkpoints") orphans = deleted;
  }
  return { threads, orphans };
}
