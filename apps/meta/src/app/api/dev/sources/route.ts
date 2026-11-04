// Development only: stores a copy of every official page the packs cite, on the machine running
// the dev server. Used where the build sandbox can't reach official sites. Off in production.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { REGISTRY } from "@/engine/rules";
import { snapshot, sourceUrls } from "@/knowledge/sources";
import { json } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "not found" }, 404);
  const body = (await req.json().catch(() => ({}))) as {
    refresh?: boolean;
    urls?: string[];
    catalog?: boolean;
  };
  const refresh = body.refresh ?? false;
  // Pack sources by default; also the catalogue's "next" pages, or any list of URLs given.
  const catalog = body.catalog
    ? (
        JSON.parse(
          await readFile(
            path.join(process.cwd(), "catalog/coverage.json"),
            "utf8",
          ),
        ) as { providers: { next: { url: string }[] }[] }
      ).providers.flatMap((p) => p.next.map((n) => n.url))
    : [];
  const urls = [
    ...new Set([
      ...sourceUrls([{ schemes: REGISTRY.schemes, lines: REGISTRY.lines }]),
      ...catalog,
      ...(body.urls ?? []).filter((u) => URL.canParse(u)),
    ]),
  ];
  const r = await snapshot(urls, {
    dir: path.join(process.cwd(), "catalog/sources"),
    refresh,
  });
  return json({ urls: urls.length, ...r });
}
