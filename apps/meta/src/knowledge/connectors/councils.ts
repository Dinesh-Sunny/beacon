// GOV.UK Local Links Manager: the official list of every council's web page for each local
// service (Council Tax Reduction, Blue Badge, free school meals, housing benefit and hundreds
// more), keyed by LGSL service code. One CSV covers every council in England, Wales and
// Scotland. The raw file is kept gzipped so the per-council index can be rebuilt offline
// (scripts/council-links.ts) whenever the choice of services changes. Open Government Licence.

import type { Connector } from "./types.ts";

export const LOCAL_LINKS_CSV =
  "https://local-links-manager.publishing.service.gov.uk/data/links_to_services_provided_by_local_authorities.csv";

export const councils: Connector = {
  id: "councils",
  name: "GOV.UK Local Links Manager",
  licence: "Open Government Licence v3.0",
  async run({ fetch, log, saveRaw }) {
    const res = await fetch(LOCAL_LINKS_CSV, {
      headers: { Accept: "text/csv" },
    });
    if (!res.ok) throw new Error(`${res.status} ${LOCAL_LINKS_CSV}`);
    const csv = await res.text();
    const lines = csv.split("\n").filter(Boolean);
    log(`columns: ${lines[0]}`);
    log(`sample: ${lines[1]}`);
    await saveRaw("local-links.csv", csv);
    return { items: lines.length - 1 };
  },
};
