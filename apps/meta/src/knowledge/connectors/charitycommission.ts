// Charity Commission for England and Wales: the full register extract (Open Government Licence).
// Keeps every registered charity that says it makes grants to individuals, with what it is for,
// who it helps, where it works and its latest income: the long tail of local benevolent funds,
// trade and profession funds and condition charities that most people never hear about.
// The kept rows go to catalog/harvest/raw/ gzipped; scripts/charity-funds.ts builds the app list.

import { unzip } from "../zip.ts";
import type { Connector } from "./types.ts";

const BASE = "https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json";
type Row = Record<string, string | number | boolean | null>;

export const charitycommission: Connector = {
  id: "charitycommission",
  name: "Charity Commission register extract",
  licence: "Open Government Licence v3.0",
  async run({ fetch, log, saveRaw }) {
    const extract = async (name: string): Promise<Row[]> => {
      const url = `${BASE}/publicextract.${name}.zip`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const files = unzip(Buffer.from(await res.arrayBuffer()));
      const [file] = files.values();
      if (!file) throw new Error(`empty zip ${url}`);
      const rows = JSON.parse(file.toString("utf8").replace(/^﻿/, "")) as Row[];
      log(
        `${name}: ${rows.length} rows, fields ${Object.keys(rows[0] ?? {}).join(", ")}`,
      );
      return rows;
    };
    const main = (r: Row) => !Number(r.linked_charity_number);
    const num = (r: Row) => String(r.registered_charity_number);

    const classes = (await extract("charity_classification")).filter(main);
    const grants = new Set(
      classes
        .filter((r) =>
          /grants to individuals/i.test(String(r.classification_description)),
        )
        .map(num),
    );
    log(`${grants.size} charities make grants to individuals`);

    const tags = new Map<
      string,
      { what: string[]; who: string[]; how: string[] }
    >();
    for (const r of classes) {
      if (!grants.has(num(r))) continue;
      const t = tags.get(num(r)) ?? { what: [], who: [], how: [] };
      const k = String(r.classification_type).toLowerCase() as
        | "what"
        | "who"
        | "how";
      t[k]?.push(String(r.classification_description));
      tags.set(num(r), t);
    }
    const areas = new Map<string, { type: string; name: string }[]>();
    for (const r of (await extract("charity_area_of_operation")).filter(main)) {
      if (!grants.has(num(r))) continue;
      const list = areas.get(num(r)) ?? [];
      list.push({
        type: String(r.geographic_area_type),
        name: String(r.geographic_area_description),
      });
      areas.set(num(r), list);
    }
    const charities = [];
    for (const r of (await extract("charity")).filter(main)) {
      if (!grants.has(num(r)) || r.charity_registration_status !== "Registered")
        continue;
      charities.push({
        number: num(r),
        name: String(r.charity_name),
        web: r.charity_contact_web ?? null,
        phone: r.charity_contact_phone ?? null,
        activities: r.charity_activities ?? null,
        income: r.latest_income ?? null,
        yearEnd: r.latest_acc_fin_period_end_date ?? null,
        registered: r.date_of_registration ?? null,
        ...tags.get(num(r)),
        areas: areas.get(num(r)) ?? [],
      });
    }
    await saveRaw(
      "charity-commission-individual-grants.json",
      JSON.stringify({
        source: BASE,
        read: new Date().toISOString().slice(0, 10),
        charities,
      }),
    );
    log(`${charities.length} registered charities kept`);
    return { items: charities.length };
  },
};
