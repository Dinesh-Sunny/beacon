// The knowledge store: a local copy of every official page the rules rely on.
// Pages are fetched once and kept as plain text in catalog/sources/, with an index of content
// hashes. Rebuilding the engine, the packs or the UI never needs a re-download; only the daily
// watch refreshes pages, and a changed hash is what opens a review.
// Runs in Node only (the dev route and scripts/watch-sources.ts), never in the browser.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SourceEntry {
  hash: string;
  file: string;
  /** When Beacon last fetched the page. */
  checked: string;
  /** When the publisher says the page last changed, if it says. */
  updated: string | null;
  title: string | null;
}
export type SourceIndex = Record<string, SourceEntry>;

export interface SnapshotResult {
  added: string[];
  changed: string[];
  unchanged: string[];
  skipped: string[];
  failed: string[];
}

const UA = "Beacon knowledge watch (+https://github.com/Dinesh-Sunny/beacon)";

/** Every URL a set of packs cites: scheme pages and the sources of screening lines. */
export function sourceUrls(packs: { schemes: { url: string }[]; lines?: Record<string, { source: string }> }[]): string[] {
  const urls = packs.flatMap((p) => [...p.schemes.map((s) => s.url), ...Object.values(p.lines ?? {}).map((l) => l.source)]);
  return [...new Set(urls)].sort();
}

export function slugOf(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, "")}${u.pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export const htmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|tr|div|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

/** GOV.UK pages come from the Content API as structured JSON; other sites as the page's main text. */
export async function fetchSource(url: string, fetchFn: FetchLike = fetch): Promise<{ text: string; updated: string | null; title: string | null }> {
  const u = new URL(url);
  if (u.hostname === "www.gov.uk" && !u.pathname.startsWith("/government/")) {
    const base = u.pathname.split("/").slice(0, 2).join("/");
    const res = await fetchFn(`https://www.gov.uk/api/content${base}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const j = (await res.json()) as {
      title?: string;
      description?: string;
      public_updated_at?: string;
      details?: Record<string, unknown> & { parts?: { title: string; body: string }[] };
    };
    // Guides have parts; start pages (format "transaction") spread their text over several
    // HTML fields, so take every one rather than only "body".
    const d = j.details ?? {};
    const parts = d.parts?.length
      ? d.parts.map((p) => `## ${p.title}\n\n${htmlToText(p.body)}`)
      : [j.description ?? "", ...Object.values(d).filter((v): v is string => typeof v === "string" && v.includes("<")).map(htmlToText)];
    return { text: parts.join("\n\n"), updated: j.public_updated_at ?? null, title: j.title ?? null };
  }
  const res = await fetchFn(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const html = await res.text();
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  return { text: htmlToText(main), updated: null, title };
}

const hashOf = (text: string) => createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

async function readIndex(file: string): Promise<SourceIndex> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as SourceIndex;
  } catch {
    return {};
  }
}

/**
 * Saves each page into `dir`. By default only pages not stored yet are fetched, so nothing is
 * downloaded twice; `refresh` re-fetches everything (the daily watch) and reports real changes.
 */
export async function snapshot(urls: string[], opts: { dir: string; refresh?: boolean; today?: string; fetchFn?: FetchLike }): Promise<SnapshotResult> {
  const { dir, refresh = false, fetchFn = fetch } = opts;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const indexFile = path.join(dir, "index.json");
  await mkdir(dir, { recursive: true });
  const index = await readIndex(indexFile);
  const out: SnapshotResult = { added: [], changed: [], unchanged: [], skipped: [], failed: [] };

  await Promise.all(
    urls.map(async (url) => {
      const before = index[url];
      if (before && !refresh) {
        out.skipped.push(url);
        return;
      }
      try {
        const page = await fetchSource(url, fetchFn);
        const hash = hashOf(page.text);
        if (before?.hash === hash) {
          out.unchanged.push(url);
          return;
        }
        const file = `${slugOf(url)}.md`;
        const head = [`# ${page.title ?? url}`, "", `Source: ${url}`, `Fetched: ${today}`, page.updated ? `Publisher updated: ${page.updated}` : "", ""];
        await writeFile(path.join(dir, file), `${head.filter((l, i) => l || i < 2 || i === head.length - 1).join("\n")}\n${page.text}\n`);
        index[url] = { hash, file, checked: today, updated: page.updated, title: page.title };
        (before ? out.changed : out.added).push(url);
      } catch (e) {
        out.failed.push(`${url}: ${(e as Error).message}`);
      }
    }),
  );

  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(indexFile, `${JSON.stringify(sorted, null, 1)}\n`);
  return out;
}
