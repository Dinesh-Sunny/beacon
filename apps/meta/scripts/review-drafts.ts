// Sorts Muse Spark's drafts into ready, needs facts, invalid and duplicate, using the live
// schema and packs. No model, no network: re-run it after any engine change.
// Usage: node scripts/review-drafts.ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import { PackSchema } from "../src/engine/pack.ts";
import {
  type DraftFile,
  factRoadmap,
  review,
} from "../src/knowledge/review.ts";

const files = (await readdir("packs")).filter((f) => /^[a-z-]+\.json$/.test(f));
const packs = await Promise.all(
  files.map(async (f) =>
    PackSchema.parse(JSON.parse(await readFile(`packs/${f}`, "utf8"))),
  ),
);
const drafts: DraftFile = JSON.parse(
  await readFile("catalog/drafts/drafts.json", "utf8"),
);
const rows = review(drafts, packs);
const by = Object.groupBy(rows, (r) => r.status);
const roadmap = factRoadmap(rows);
await writeFile(
  "catalog/drafts/review.json",
  `${JSON.stringify({ counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v?.length ?? 0])), roadmap, rows }, null, 1)}\n`,
);
console.log(
  "Questions that would unlock the most drafts:",
  roadmap
    .slice(0, 8)
    .map((r) => `${r.fact} (${r.unlocks}+${r.alsoNeeds})`)
    .join(", "),
);
console.log(
  Object.entries(by)
    .map(([k, v]) => `${k}: ${v?.length}`)
    .join(", "),
);
