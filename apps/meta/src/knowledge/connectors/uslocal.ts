// US local help, from three official open datasets (US government works, public domain):
// - HRSA: every Health Center Program site and look-alike (sliding-fee primary care, dental,
//   mental health; nobody is turned away for not being able to pay).
// - HUD: every Public Housing Agency (who runs public housing and Section 8 vouchers locally).
// - HUD: every HUD-approved housing counseling agency (free or low-cost help with rent,
//   foreclosure, buying and homelessness).
// Raw downloads go to catalog/harvest/raw/ gzipped; scripts/us-local.ts builds the app index.

import type { Connector } from "./types.ts";

const HRSA = [
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
  "https://data.hrsa.gov//DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
];
const PHA =
  "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Public_Housing_Authorities/FeatureServer/0/query";
const PHA_FIELDS = [
  "PARTICIPANT_CODE",
  "FORMAL_PARTICIPANT_NAME",
  "HA_PHN_NUM",
  "HA_EMAIL_ADDR_TEXT",
  "HA_PROGRAM_TYPE",
  "STD_ADDR",
  "STD_CITY",
  "STD_ST",
  "STD_ZIP5",
  "CURCNTY",
  "CURCNTY_NM",
  "LAT",
  "LON",
].join(",");
const COUNSELORS = [
  "https://data.hud.gov/Housing_Counselor/searchByLocation?Lat=39.8&Long=-98.5&Distance=5000",
  "https://data.hud.gov/Housing_Counselor/search?AgencyName=&City=&State=&RowLimit=&Services=&Languages=",
];

export const uslocal: Connector = {
  id: "uslocal",
  name: "HRSA health centers, HUD housing agencies and counselors",
  licence: "US government work, public domain",
  async run({ fetch, log, saveRaw }) {
    let items = 0;

    // HRSA health center sites (CSV).
    let csv = "";
    for (const url of HRSA) {
      const res = await fetch(url, { headers: { Accept: "text/csv" } });
      log(`hrsa ${res.status} ${url}`);
      if (res.ok) {
        csv = await res.text();
        break;
      }
    }
    if (csv) {
      const lines = csv.split("\n").filter(Boolean);
      log(`hrsa columns: ${lines[0]}`);
      log(`hrsa sample: ${lines[1]}`);
      await saveRaw("us-hrsa-sites.csv", csv);
      items += lines.length - 1;
    }

    // HUD public housing agencies (ArcGIS, paged).
    const phas: unknown[] = [];
    for (let offset = 0; offset < 20000; offset += 2000) {
      const q = new URLSearchParams({
        where: "1=1",
        outFields: PHA_FIELDS,
        returnGeometry: "false",
        resultOffset: String(offset),
        resultRecordCount: "2000",
        orderByFields: "OBJECTID",
        f: "json",
      });
      const res = await fetch(`${PHA}?${q}`);
      if (!res.ok) throw new Error(`${res.status} ${PHA}`);
      const page = (await res.json()) as {
        features?: { attributes: unknown }[];
      };
      const rows = (page.features ?? []).map((f) => f.attributes);
      phas.push(...rows);
      if (rows.length < 2000) break;
    }
    log(`pha rows: ${phas.length}; sample ${JSON.stringify(phas[0])}`);
    await saveRaw("us-hud-pha.json", JSON.stringify(phas));
    items += phas.length;

    // HUD housing counseling agencies (JSON).
    for (const url of COUNSELORS) {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      log(`counselors ${res.status} ${url}`);
      if (!res.ok) continue;
      const text = await res.text();
      let rows: unknown[] = [];
      try {
        rows = JSON.parse(text) as unknown[];
      } catch {
        log(`counselors not JSON: ${text.slice(0, 200)}`);
        continue;
      }
      if (!Array.isArray(rows) || !rows.length) continue;
      log(
        `counselor rows: ${rows.length}; sample ${JSON.stringify(rows[0]).slice(0, 600)}`,
      );
      await saveRaw("us-hud-counselors.json", text);
      items += rows.length;
      break;
    }
    return { items };
  },
};
