// Development only: stores a copy of every official page the packs cite, on the machine running
// the dev server. Used where the build sandbox can't reach official sites. Off in production.
import path from "node:path";
import { snapshot, sourceUrls } from "@/knowledge/sources";
import { REGISTRY } from "@/engine/rules";
import { json } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return json({ error: "not found" }, 404);
  const { refresh = false } = (await req.json().catch(() => ({}))) as { refresh?: boolean };
  const urls = sourceUrls([{ schemes: REGISTRY.schemes, lines: REGISTRY.lines }]);
  const r = await snapshot(urls, { dir: path.join(process.cwd(), "catalog/sources"), refresh });
  return json({ urls: urls.length, ...r });
}
