// Knowledge watch: checks every official page the rule pack relies on and records a content hash.
// Runs on a schedule in GitHub Actions (GOV.UK is reachable there), never on the request path.
// When a page changes, the lock file changes and the workflow opens a pull request for review,
// so live checks keep running on the last good pack while the rules are updated.
//
// Usage: node scripts/watch-sources.mjs [--pack packs/uk-core.json]

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const packPath = process.argv.includes("--pack") ? process.argv[process.argv.indexOf("--pack") + 1] : "packs/uk-core.json";
const lockPath = packPath.replace(/\.json$/, ".sources.json");
const pack = JSON.parse(await readFile(packPath, "utf8"));

const urls = [...new Set([...pack.schemes.map((s) => s.url), ...Object.values(pack.lines).map((l) => l.source)])].sort();
let lock = {};
try {
  lock = JSON.parse(await readFile(lockPath, "utf8"));
} catch {
  // first run
}

// GOV.UK pages come from the Content API as structured JSON; other sites as page text.
async function fetchText(url) {
  const u = new URL(url);
  if (u.hostname === "www.gov.uk") {
    const base = u.pathname.split("/").slice(0, 2).join("/");
    const res = await fetch(`https://www.gov.uk/api/content${base}`, { headers: { "User-Agent": "Beacon knowledge watch" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const j = await res.json();
    const parts = j.details?.parts?.map((p) => `${p.title}\n${p.body}`) ?? [j.details?.body ?? ""];
    return { text: parts.join("\n"), updated: j.public_updated_at ?? null };
  }
  const res = await fetch(url, { headers: { "User-Agent": "Beacon knowledge watch" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const html = await res.text();
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return { text: main, updated: null };
}

const clean = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const today = new Date().toISOString().slice(0, 10);
const changed = [];
const failed = [];
const next = {};
for (const url of urls) {
  try {
    const { text, updated } = await fetchText(url);
    const hash = createHash("sha256").update(clean(text)).digest("hex").slice(0, 16);
    const before = lock[url];
    if (before && before.hash !== hash) changed.push(url);
    // Unchanged pages keep their old entry, so the lock (and a pull request) only moves on real change.
    next[url] = before && before.hash === hash ? before : { hash, updated, checked: today };
  } catch (e) {
    failed.push(`${url}: ${e.message}`);
    if (lock[url]) next[url] = lock[url];
  }
}

await writeFile(lockPath, `${JSON.stringify(next, null, 1)}\n`);
const summary = [
  `## Knowledge watch, ${today}`,
  `${urls.length} official pages checked for pack ${pack.id} ${pack.version}.`,
  changed.length ? `### Changed (${changed.length}) - re-check the rules that cite these\n${changed.map((u) => `- ${u}`).join("\n")}` : "No content changes.",
  failed.length ? `### Couldn't fetch (${failed.length})\n${failed.map((f) => `- ${f}`).join("\n")}` : "",
].join("\n\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `changed=${changed.length}\n`, { flag: "a" });
