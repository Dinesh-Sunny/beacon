// Builds src/data/more-help.json: help found by the harvest and triage that the rules can't
// screen yet, so results can still point people to it. Drops pages already in a pack and
// services everyone gets (the draft review's quality gate). Re-run after a harvest.
// Usage: node scripts/more-help.ts
import { readdir, readFile, writeFile } from "node:fs/promises";

interface Triage {
  url: string;
  title: string;
  support: boolean;
  name: string;
  kind: string | null;
  provider: string | null;
  people: string[];
  nations: string[];
}
interface ReviewRow {
  url: string;
  status: string;
  issues: string[];
}

const triage = Object.values(
  JSON.parse(await readFile("catalog/harvest/triage.json", "utf8")) as Record<
    string,
    Triage
  >,
);
const review = (
  JSON.parse(await readFile("catalog/drafts/review.json", "utf8")) as {
    rows: ReviewRow[];
  }
).rows;
const service = new Set(
  review
    .filter((r) => r.issues.some((i) => i.includes("service rather than help")))
    .map((r) => r.url),
);
const files = (await readdir("packs")).filter((f) => /^[a-z-]+\.json$/.test(f));
const packs = await Promise.all(
  files.map(
    async (f) =>
      JSON.parse(await readFile(`packs/${f}`, "utf8")) as {
        schemes: { url: string }[];
      },
  ),
);
const pageKey = (u: string) =>
  new URL(u).pathname.split("/").filter(Boolean)[0] ?? "";
const live = new Set(
  packs.flatMap((p) => p.schemes.map((s) => pageKey(s.url))),
);
const liveNames = new Set(
  packs.flatMap((p) =>
    (p.schemes as { name?: string }[]).map((s) =>
      s.name?.toLowerCase().split(" ").slice(0, 2).join(" "),
    ),
  ),
);

// Schemes the page itself says are closed to new claims, judged from its opening lines.
const index = JSON.parse(
  await readFile("catalog/sources/index.json", "utf8"),
) as Record<string, { file: string }>;
const CLOSED =
  /no longer (apply|claim|make a new claim)|closed to new|cannot make a new claim|can no longer|has ended|have ended/i;
const closed = new Set<string>();
for (const t of triage) {
  const file = index[t.url]?.file;
  if (!file) continue;
  const head = (await readFile(`catalog/sources/${file}`, "utf8")).slice(
    0,
    900,
  );
  if (
    CLOSED.test(head) ||
    /incapacity benefit|severe disablement allowance/i.test(t.name)
  )
    closed.add(t.url);
}

const rows = triage
  .filter(
    (t) =>
      t.support &&
      t.name &&
      !service.has(t.url) &&
      !closed.has(t.url) &&
      !live.has(pageKey(t.url)) &&
      !liveNames.has(t.name.toLowerCase().split(" ").slice(0, 2).join(" ")),
  )
  .map((t) => ({
    name: t.name,
    title: t.title,
    url: t.url,
    kind: t.kind,
    provider: t.provider,
    people: t.people,
    nations: t.nations,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))
  // One row per name: GOV.UK often has a guide and a start page for the same help.
  .filter(
    (r, i, all) =>
      all.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase()) === i,
  );
await writeFile("src/data/more-help.json", `${JSON.stringify(rows)}\n`);
console.log(
  `src/data/more-help.json: ${rows.length} pages of help (${closed.size} closed schemes left out)`,
);
