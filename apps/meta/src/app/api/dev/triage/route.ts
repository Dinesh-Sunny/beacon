// Development only: runs Muse Spark triage over harvested pages in the background.
import { json } from "@/server/http";
import { progress, triage } from "@/server/triage";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") return json({ error: "not found" }, 404);
  if (progress.running) return json({ started: false, reason: "already running" }, 409);
  void triage(process.cwd());
  return json({ started: true }, 202);
}

export function GET() {
  if (process.env.NODE_ENV !== "development") return json({ error: "not found" }, 404);
  return json(progress);
}
