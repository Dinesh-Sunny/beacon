// Builds src/data/us-local.json from the raw files kept by the uslocal connector: by state, every
// open HRSA health center site (not admin-only, school or prison sites), every HUD Public Housing
// Agency, and every HUD-approved housing counseling agency, with what they help with. The server
// ranks them by distance from a ZIP code. Rebuild offline: node scripts/us-local.ts
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./csv.ts";
import { setCount } from "./data-counts.ts";

const raw = async (f: string) =>
  gunzipSync(await readFile(`catalog/harvest/raw/${f}`)).toString("utf8");
const clean = (s: unknown) =>
  String(s ?? "")
    // HUD pads empty fields with NUL characters.
    .replaceAll(String.fromCharCode(0), "")
    .replace(/\s+/g, " ")
    .trim();
const round = (n: number) => Math.round(n * 1e4) / 1e4;
/** "7878893666" or "787-889-3666" -> "787-889-3666"; anything else is dropped. */
const phone = (s: unknown) => {
  const d = clean(s)
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 && !/^0+$/.test(d)
    ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    : null;
};
const web = (s: unknown) => {
  const u = clean(s);
  if (!u || u.length < 4) return null;
  const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  return URL.canParse(full) ? full : null;
};
/** Title case for names HUD keeps in capitals. */
const title = (s: string) =>
  s === s.toUpperCase()
    ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    : s;

// Each place: [name, address, city, zip, phone, web, lat, lon, extra]
type Row = [
  string,
  string,
  string,
  string,
  string | null,
  string | null,
  number,
  number,
  string,
];
const states: Record<string, { c: Row[]; h: Row[]; k: Row[] }> = {};
const at = (st: string) => {
  states[st] ??= { c: [], h: [], k: [] };
  return states[st];
};

// HRSA health center sites.
const [head, ...body] = parseCsv(
  (await raw("us-hrsa-sites.csv.gz")).replace(/^﻿/, ""),
);
const col = (name: string) => {
  const i = head?.indexOf(name) ?? -1;
  if (i < 0) throw new Error(`HRSA column missing: ${name}`);
  return i;
};
const C = {
  name: col("Site Name"),
  addr: col("Site Address"),
  city: col("Site City"),
  st: col("Site State Abbreviation"),
  zip: col("Site Postal Code"),
  tel: col("Site Telephone Number"),
  web: col("Site Web Address"),
  setting: col(
    "Health Center Service Delivery Site Location Setting Description",
  ),
  kind: col("Health Center Type Description"),
  where: col("Health Center Location Type Description"),
  status: col("Site Status Description"),
  x: col("Geocoding Artifact Address Primary X Coordinate"),
  y: col("Geocoding Artifact Address Primary Y Coordinate"),
};
const SKIP_SETTING =
  /School|Carceral|Correctional|Nursing Home|Domestic Violence/;
let centers = 0;
for (const r of body) {
  if (r.length < head.length - 1) continue;
  const lat = Number(r[C.y]);
  const lon = Number(r[C.x]);
  if (
    r[C.status] !== "Active" ||
    r[C.kind] === "Administrative" ||
    SKIP_SETTING.test(r[C.setting] ?? "") ||
    !lat ||
    !lon
  )
    continue;
  const where =
    r[C.where] === "Mobile Van"
      ? "mobile"
      : r[C.where] === "Seasonal"
        ? "seasonal"
        : "";
  at(clean(r[C.st])).c.push([
    clean(r[C.name]),
    clean(r[C.addr]),
    clean(r[C.city]),
    clean(r[C.zip]).slice(0, 5),
    phone(r[C.tel]),
    web(r[C.web]),
    round(lat),
    round(lon),
    where,
  ]);
  centers++;
}

// HUD Public Housing Agencies: who runs public housing and Section 8 vouchers locally.
const PROGRAM: Record<string, string> = {
  "Low-Rent": "public",
  "Section 8": "vouchers",
  Combined: "both",
};
let agencies = 0;
for (const p of JSON.parse(await raw("us-hud-pha.json.gz")) as Record<
  string,
  string | number | null
>[]) {
  const st = clean(p.STD_ST);
  if (!st || !p.LAT || !p.LON) continue;
  at(st).h.push([
    title(clean(p.FORMAL_PARTICIPANT_NAME)),
    title(clean(p.STD_ADDR)),
    title(clean(p.STD_CITY)),
    clean(p.STD_ZIP5),
    phone(p.HA_PHN_NUM),
    null,
    round(Number(p.LAT)),
    round(Number(p.LON)),
    PROGRAM[clean(p.HA_PROGRAM_TYPE)] ?? "",
  ]);
  agencies++;
}

// HUD-approved housing counseling agencies. HUD service codes (counseling, not workshops):
// RHC renting, HIC homelessness, DFC behind on a mortgage, FBC budgeting and credit,
// PPC buying a home, HMC reverse mortgages.
const HELPS: Record<string, string> = {
  RHC: "rent",
  HIC: "homeless",
  DFC: "mortgage",
  FBC: "money",
  PPC: "buying",
  HMC: "reverse",
};
let counselors = 0;
for (const a of JSON.parse(await raw("us-hud-counselors.json.gz")) as Record<
  string,
  string | null
>[]) {
  const st = clean(a.statecd);
  const lat = Number(a.agc_ADDR_LATITUDE);
  const lon = Number(a.agc_ADDR_LONGITUDE);
  if (!st || !lat || !lon || a.agc_STATUS === "C") continue;
  const helps = clean(a.services)
    .split(",")
    .map((s) => HELPS[s])
    .filter(Boolean);
  const langs = clean(a.languages)
    .split(",")
    .filter((l) => l && l !== "ENG")
    .join(" ");
  at(st).k.push([
    title(clean(a.nme)),
    clean(a.adr1),
    title(clean(a.city)),
    clean(a.zipcd).slice(0, 5),
    phone(a.phone1),
    web(a.weburl),
    round(lat),
    round(lon),
    [helps.join(" "), langs].filter(Boolean).join("|"),
  ]);
  counselors++;
}

await writeFile(
  "src/data/us-local.json",
  `${JSON.stringify({
    sources: {
      c: "https://data.hrsa.gov/data/download",
      h: "https://hudgis-hud.opendata.arcgis.com/datasets/public-housing-authorities",
      k: "https://data.hud.gov/housing_counseling.html",
    },
    licence: "US government work, public domain",
    states,
  })}\n`,
);
console.log(
  `src/data/us-local.json: ${centers} health center sites, ${agencies} housing agencies, ${counselors} housing counselors across ${Object.keys(states).length} states and territories`,
);
await setCount("usLocal", {
  centers,
  agencies,
  counselors,
  states: Object.keys(states).length,
});
