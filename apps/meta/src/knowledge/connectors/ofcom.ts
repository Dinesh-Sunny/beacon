// Ofcom's list of broadband and phone social tariffs: one table, one row per package, with
// price, average speed and where it's available. Kept as structured rows so results can show
// the cheapest packages where someone lives, with the date Ofcom's list was read.

import { htmlToText } from "../sources.ts";
import type { Connector } from "./types.ts";

const URL_ = "https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs";

const cells = (row: string) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => htmlToText(m[1] ?? "").replace(/\s+/g, " ").trim());

export const ofcom: Connector = {
  id: "ofcom",
  name: "Ofcom social tariffs table",
  licence: "Ofcom website content, linked with attribution",
  async run({ fetch, log, save }) {
    const res = await fetch(URL_, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`${res.status} ${URL_}`);
    const html = await res.text();
    const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0];
    if (!table) throw new Error("no table on the Ofcom page");
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => cells(m[0])).filter((c) => c.length >= 4);
    const [head, ...body] = rows;
    log(`columns: ${head?.join(" | ")}`);
    const tariffs = body
      .map(([pkg = "", price = "", speed = "", where = ""]) => ({
        package: pkg.replace(/\*+/g, "").trim(),
        monthly: Number(price.match(/£\s*([\d.]+)/)?.[1] ?? Number.NaN),
        price,
        speed,
        where: where.replace(/\*+/g, "").trim(),
      }))
      .filter((t) => t.package && Number.isFinite(t.monthly));
    await save("ofcom-social-tariffs.json", { source: URL_, read: new Date().toISOString().slice(0, 10), tariffs });
    log(`${tariffs.length} tariffs`);
    return { items: tariffs.length };
  },
};
