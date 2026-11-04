// Knowledge watch: refreshes the stored copy of every official page the packs cite.
// Runs daily in GitHub Actions (official sites are reachable there), never on the request path.
// A changed page changes catalog/sources/, and the workflow opens a pull request for review,
// so live checks keep running on the last good pack while the rules are re-checked.
//
// Usage: node scripts/watch-sources.ts [--missing]   (--missing fetches only pages not stored yet)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { snapshot, sourceUrls } from "../src/knowledge/sources.ts";

const files = (await readdir("packs")).filter((f) => /^[a-z-]+\.json$/.test(f));
const packs = await Promise.all(
  files.map(async (f) => JSON.parse(await readFile(`packs/${f}`, "utf8"))),
);
const urls = sourceUrls(packs);
const r = await snapshot(urls, {
  dir: "catalog/sources",
  refresh: !process.argv.includes("--missing"),
});

const list = (title: string, xs: string[]) =>
  xs.length
    ? `### ${title} (${xs.length})\n${xs.map((u) => `- ${u}`).join("\n")}`
    : "";
const summary = [
  `## Knowledge watch, ${new Date().toISOString().slice(0, 10)}`,
  `${urls.length} official pages across ${packs.length} packs: ${r.unchanged.length} unchanged, ${r.skipped.length} already stored.`,
  list("Changed - re-check the rules that cite these", r.changed),
  list("New", r.added),
  list("Couldn't fetch", r.failed),
]
  .filter(Boolean)
  .join("\n\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });
if (process.env.GITHUB_OUTPUT)
  await writeFile(
    process.env.GITHUB_OUTPUT,
    `changed=${r.changed.length + r.added.length}\n`,
    { flag: "a" },
  );
