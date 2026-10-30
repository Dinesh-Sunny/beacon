import { sql } from "drizzle-orm";
import { getDb } from "./client.ts";

export type DatabaseHealth =
  | { ok: true; latencyMs: number }
  | { ok: false; error: string };

// Callers decide what to expose: the error text can name hosts, so keep it in server logs.
export async function checkDatabase(): Promise<DatabaseHealth> {
  const started = performance.now();
  try {
    await getDb().execute(sql`select 1`);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
