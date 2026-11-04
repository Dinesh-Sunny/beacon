// Development only: starts a harvest in the background on the machine running the dev server
// (which can reach official sites) and reports progress. Off in production.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { harvest } from "@/knowledge/harvest";
import { json } from "@/server/http";

export const runtime = "nodejs";
let running: Promise<unknown> | null = null;

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  if (running) return json({ started: false, reason: "already running" }, 409);
  const { only = [] } = (await req.json().catch(() => ({}))) as {
    only?: string[];
  };
  running = harvest(process.cwd(), only).finally(() => {
    running = null;
  });
  return json({ started: true }, 202);
}

export async function GET() {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  const file = path.join(process.cwd(), "catalog/harvest/status.json");
  return json(JSON.parse(await readFile(file, "utf8").catch(() => "{}")));
}
