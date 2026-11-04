// Builds src/data/charity-funds.json (server only) from the Charity Commission rows kept by the
// charitycommission connector: grant-giving charities for people in the UK whose purposes match
// Beacon's people groups, indexed by the area they work in. Rebuild offline after changing
// the filters; the extract never needs downloading again.
// Usage: node scripts/charity-funds.ts
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

interface Raw {
  number: string;
  name: string;
  web: string | null;
  activities: string | null;
  income: number | null;
  yearEnd: string | null;
  what?: string[];
  who?: string[];
  areas: { type: string; name: string }[];
}
const raw = JSON.parse(
  gunzipSync(
    await readFile(
      "catalog/harvest/raw/charity-commission-individual-grants.json.gz",
    ),
  ).toString("utf8"),
) as { source: string; read: string; charities: Raw[] };

/** Purposes and beneficiaries as one-letter tags the server matches against people groups. */
const WHAT: Record<string, string> = {
  "The Prevention Or Relief Of Poverty": "p",
  Disability: "d",
  "The Advancement Of Health Or Saving Of Lives": "h",
  "Accommodation/housing": "a",
  "Education/training": "t",
};
const WHO: Record<string, string> = {
  "Elderly/old People": "e",
  "People With Disabilities": "d",
  "Children/Young People": "c",
  "The General Public/mankind": "g",
  // Funds limited to a profession, faith, ethnic or other defined group: real, but narrow.
  "Other Defined Groups": "o",
  "People Of A Particular Ethnic Or Racial Origin": "o",
};
const UK = new Set(["Scotland", "Northern Ireland", "England", "Wales"]);
/** Wide areas the register uses, and the nations they cover. */
const WIDE: Record<string, string> = {
  "Throughout England And Wales": "eng wal",
  "Throughout England": "eng",
  "Throughout Wales": "wal",
  "Throughout London": "london",
  Scotland: "sco",
  "Northern Ireland": "ni",
};

/** Activities that say the charity gives money or help to people in need, not only research or
 * worship that happens to tick "grants to individuals". */
const NEED =
  /\b(grants?|relief|hardship|in need|poverty|financial (assistance|help|support)|welfare|necessitous|distress|bursar)/i;

const funds = [];
for (const c of raw.charities) {
  const what = [
    ...new Set((c.what ?? []).map((w) => WHAT[w]).filter(Boolean)),
  ].join("");
  const who = [
    ...new Set((c.who ?? []).map((w) => WHO[w]).filter(Boolean)),
  ].join("");
  // Keep help for people here with a stated purpose Beacon can match, filed in the last 3 years.
  if (
    !what ||
    !who ||
    !(c.income && c.income > 0) ||
    (c.yearEnd ?? "") < "2023"
  )
    continue;
  // Overseas aid and worship-first charities rarely help someone here with a bill or a crisis.
  const overseas = c.areas.some((a) => a.type === "Country" && !UK.has(a.name));
  const worship =
    (c.what ?? []).includes("Religious Activities") && !what.includes("p");
  if (
    overseas ||
    worship ||
    (c.what ?? []).includes("Overseas Aid/famine Relief")
  )
    continue;
  const local = c.areas
    .filter((a) => a.type === "Local Authority")
    .map((a) => a.name);
  const wide = c.areas.flatMap((a) =>
    WIDE[a.name] ? WIDE[a.name].split(" ") : [],
  );
  if (!local.length && !wide.length) continue;
  funds.push({
    n: c.number,
    name: c.name,
    web: c.web,
    does: (c.activities ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
    income: c.income,
    need: NEED.test(c.activities ?? ""),
    what,
    who,
    local,
    wide: [...new Set(wide)],
  });
}
funds.sort((a, b) => b.income - a.income);
await writeFile(
  "src/data/charity-funds.json",
  `${JSON.stringify({ source: "https://register-of-charities.charitycommission.gov.uk/en/register/full-register-download", licence: "Open Government Licence v3.0", read: raw.read, funds })}\n`,
);
console.log(
  `src/data/charity-funds.json: ${funds.length} of ${raw.charities.length} charities, ${funds.filter((f) => f.local.length).length} local`,
);
