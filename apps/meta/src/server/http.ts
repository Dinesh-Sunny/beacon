import "server-only";
import { MetaError, MetaOffline } from "./meta";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Turns any failure into a calm reply the UI can show. Details go to the server log only. */
export function failure(err: unknown) {
  if (err instanceof MetaOffline) return json({ error: "offline" }, 503);
  if (err instanceof MetaError) {
    console.error(`[meta] ${err.status} ${err.message}`);
    return json({ error: err.status === 429 ? "busy" : "model" }, err.status === 429 ? 429 : 502);
  }
  if (err instanceof Error && err.name === "TimeoutError") return json({ error: "slow" }, 504);
  console.error("[beacon]", err);
  return json({ error: "model" }, 500);
}
