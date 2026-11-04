// Builds src/data/charity-grants.json from the 360Giving connector: funders that make grants to
// individuals for hardship, health, education or daily living. Research, arts and business
// funders are left out. National funders reach everyone; local ones are matched by place.
// Usage: node scripts/charity-grants.ts
import { readFile, writeFile } from "node:fs/promises";

interface Funder {
  name: string;
  orgId: string;
  website: string | null;
  licence: string | null;
  sampled: number;
  toIndividuals: number;
  medianAward: number | null;
  latest: string | null;
  programmes: string[];
  places: string[];
}
const h = JSON.parse(
  await readFile("catalog/harvest/threesixty-individual-funders.json", "utf8"),
) as { read: string; funders: Funder[] };

// Grants to people for things other than hardship or daily life (research, art, enterprise, heritage).
const NOT_WELFARE =
  /mellon|arts trust|historic environment|firstport|disaster|haberdashers|teaching staff/i;
// Funders with no grants to individuals in the last five years may have stopped.
const RECENT = `${Number(h.read.slice(0, 4)) - 5}`;
// Funders whose individual grants are spread across the country rather than one area.
const spread = (f: Funder) =>
  (!f.places.length || new Set(f.places).size >= 3) &&
  !/hampton|barnwood|somerset|wales|barking|imperial/i.test(f.name);

const funders = h.funders
  .filter(
    (f) =>
      !NOT_WELFARE.test(f.name) &&
      f.toIndividuals >= 20 &&
      (f.latest ?? "") >= RECENT,
  )
  .map((f) => ({
    name: f.name,
    url: f.website
      ? f.website.startsWith("http")
        ? f.website
        : `https://${f.website}`
      : null,
    typical: f.medianAward,
    latest: f.latest?.slice(0, 10) ?? null,
    programmes: f.programmes
      .map((p) => p.trim())
      .filter((p) => !/^(general|payments to individuals)/i.test(p))
      .slice(0, 3),
    national: spread(f),
    places: f.places,
    licence: f.licence,
  }));
await writeFile(
  "src/data/charity-grants.json",
  `${JSON.stringify({ source: "https://www.360giving.org/", read: h.read, funders }, null, 1)}\n`,
);
console.log(
  `src/data/charity-grants.json: ${funders.length} funders (${funders.filter((f) => f.national).length} national)`,
);
