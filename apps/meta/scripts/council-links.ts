// Builds src/data/council-links.json from the Local Links Manager CSV kept by the councils
// connector: for every council (by GSS code), its own page for each local service that helps
// people with money, care, housing, school or getting around. Rebuild offline after changing
// SERVICES; the raw file never needs downloading again.
// Usage: node scripts/council-links.ts
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./csv.ts";
import { setCount } from "./data-counts.ts";

/** LGSL code -> how Beacon names the service, who it's for (Beacon Framework people groups),
 * and the pack scheme it matches, if one already checks it. An empty people list keeps the link
 * for later (an appeal, say) without offering it to anyone up front. */
const SERVICES: Record<
  number,
  { label: string; people: string[]; scheme?: string }
> = {
  63: {
    label: "Council Tax Reduction",
    people: ["lowpay", "outofwork", "older"],
    scheme: "ctr",
  },
  59: {
    label: "Council Tax discounts",
    people: ["older", "disabled", "carers", "young"],
    scheme: "ctsingle",
  },
  69: { label: "Housing Benefit", people: ["older", "lowpay"], scheme: "hb" },
  72: { label: "Housing Benefit appeals", people: [] },
  112: {
    label: "Help if you're homeless or about to be",
    people: [],
  },
  107: {
    label: "Sheltered and supported housing",
    people: ["older", "disabled"],
  },
  137: { label: "Disabled Facilities Grant", people: ["disabled", "older"] },
  178: {
    label: "Home adaptations and aids",
    people: ["disabled", "older", "carers"],
  },
  147: { label: "Help with garden maintenance", people: ["older", "disabled"] },
  209: {
    label: "Care needs assessment",
    people: ["older", "disabled", "carers"],
  },
  287: {
    label: "Direct payments for care",
    people: ["older", "disabled", "carers"],
  },
  260: {
    label: "Short breaks for disabled children",
    people: ["families", "carers"],
  },
  313: {
    label: "Community alarms and telecare",
    people: ["older", "disabled"],
  },
  315: { label: "Meals at home", people: ["older", "disabled"] },
  296: { label: "Day centres", people: ["older", "disabled", "carers"] },
  328: { label: "Bereavement support", people: ["events"] },
  279: { label: "Blue Badge", people: ["disabled", "older"], scheme: "bb" },
  274: { label: "Disabled parking bays", people: ["disabled"] },
  280: {
    label: "Bus pass for older or disabled people",
    people: ["older", "disabled"],
    scheme: "bus",
  },
  273: { label: "Older person's bus pass", people: ["older"], scheme: "bus" },
  272: {
    label: "Community and accessible transport",
    people: ["older", "disabled"],
  },
  4: {
    label: "Free school meals",
    people: ["families", "lowpay"],
    scheme: "fsm",
  },
  2: { label: "School uniform grants", people: ["families"] },
  3: { label: "Help with school transport", people: ["families"] },
  40: {
    label: "School transport for special educational needs",
    people: ["families"],
  },
  1135: {
    label: "Travel help for 16 to 19 year olds in education",
    people: ["young", "families"],
  },
  9: {
    label: "Special educational needs assessment",
    people: ["families"],
  },
  12: { label: "Nursery places", people: ["families"] },
  1741: { label: "Free early years education", people: ["families"] },
  19: { label: "Childcare out of school hours", people: ["families"] },
  18: { label: "School holiday activities", people: ["families"] },
  1579: { label: "Family information service", people: ["families"] },
  831: { label: "Family support groups", people: ["families"] },
};

const csv = gunzipSync(
  await readFile("catalog/harvest/raw/local-links.csv.gz"),
).toString("utf8");

const [head, ...body] = parseCsv(csv);
const col = (name: string) => head?.indexOf(name) ?? -1;
const [NAME, GSS, LGSL, LINK] = ["Authority Name", "GSS", "LGSL", "URL"].map(
  col,
);
const councils: Record<
  string,
  { name: string; links: Record<string, string> }
> = {};
let links = 0;
for (const r of body) {
  const code = Number(r[LGSL]);
  const url = r[LINK]?.trim();
  const gss = r[GSS]?.trim();
  if (!SERVICES[code] || !gss || !url || !URL.canParse(url)) continue;
  councils[gss] ??= { name: r[NAME] ?? gss, links: {} };
  const c = councils[gss];
  // Some services have several interactions (apply, find out); the first link stands for them.
  if (!c.links[code]) {
    c.links[code] = url;
    links++;
  }
}
await writeFile(
  "src/data/council-links.json",
  `${JSON.stringify({ source: "https://local-links-manager.publishing.service.gov.uk/data/links_to_services_provided_by_local_authorities.csv", licence: "Open Government Licence v3.0", services: SERVICES, councils })}\n`,
);
console.log(
  `src/data/council-links.json: ${links} links across ${Object.keys(councils).length} councils, ${Object.keys(SERVICES).length} services`,
);
await setCount("councilLinks", {
  links,
  councils: Object.keys(councils).length,
  services: Object.keys(SERVICES).length,
});
