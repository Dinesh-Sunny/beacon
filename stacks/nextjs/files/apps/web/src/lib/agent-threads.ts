import { getDb } from "@__NAME__/db";
import type { AgentName } from "@/lib/agents";

// Shown in the conversation list; older ones stay reachable until retention removes them.
const THREAD_LIST_LIMIT = 50;

export type AgentThreadSummary = {
  id: string;
  title: string | null;
  updatedAt: Date;
};

// The signed-in user's conversations with one agent, newest first. Read straight from our
// Postgres (no sidecar call); messages themselves come from the sidecar when one is opened.
export async function listAgentThreads(
  userId: string,
  agent: AgentName,
): Promise<AgentThreadSummary[]> {
  const { rows } = await getDb().$client.query<{
    id: string;
    title: string | null;
    updated_at: Date;
  }>(
    `select id, title, updated_at from agent_threads
      where user_id = $1::uuid and agent = $2
      order by updated_at desc limit $3`,
    [userId, agent, THREAD_LIST_LIMIT],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}
