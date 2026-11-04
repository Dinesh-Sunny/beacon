// Development only: Muse Spark drafts schemes from pages triage marked as help, in the background.

import { draftAll, draftProgress } from "@/server/drafts";
import { json } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  if (draftProgress.running)
    return json({ started: false, reason: "already running" }, 409);
  const { limit = 2000 } = (await req.json().catch(() => ({}))) as {
    limit?: number;
  };
  void draftAll(process.cwd(), { limit });
  return json({ started: true }, 202);
}

export function GET() {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  return json(draftProgress);
}
