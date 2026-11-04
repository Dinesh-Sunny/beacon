// Builds src/data/social-tariffs.json from the Ofcom connector's harvest: packages available
// across a whole nation (regional ones need an exact address), cheapest first.
// Usage: node scripts/social-tariffs.ts
import { readFile, writeFile } from "node:fs/promises";

interface Tariff {
  package: string;
  monthly: number;
  speed: string;
  where: string;
}
const h = JSON.parse(
  await readFile("catalog/harvest/ofcom-social-tariffs.json", "utf8"),
) as { source: string; read: string; tariffs: Tariff[] };
const NATIONS = {
  eng: "England",
  sco: "Scotland",
  wal: "Wales",
  ni: "Northern Ireland",
} as const;
// A whole-nation package names the nation (or the UK) with no region in brackets.
const covers = (where: string) =>
  (Object.keys(NATIONS) as (keyof typeof NATIONS)[]).filter(
    (n) =>
      !where.includes("(") &&
      (/^UK$/.test(where.trim()) || where.includes(NATIONS[n])),
  );
const tariffs = h.tariffs
  .map((t) => ({
    package: t.package,
    monthly: t.monthly,
    speed: t.speed,
    nations: covers(t.where),
  }))
  .filter((t) => t.nations.length)
  .sort((a, b) => a.monthly - b.monthly);
await writeFile(
  "src/data/social-tariffs.json",
  `${JSON.stringify({ source: h.source, read: h.read, tariffs }, null, 1)}\n`,
);
console.log(
  `src/data/social-tariffs.json: ${tariffs.length} of ${h.tariffs.length} packages cover a whole nation`,
);
