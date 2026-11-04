// 360Giving: open data on UK grants (CC BY and similar open licences). The registry lists every
// publisher; the 360Giving API gives each funder's grants. This connector finds funders that
// make grants to individuals (the "charities" side of the Beacon Framework), with how many,
// typical amounts and the programmes they run, so people can be pointed to grant-makers that
// actually help people directly. Attribute and link to each publisher.

import type { Connector } from "./types.ts";

const REGISTRY = "https://registry.threesixtygiving.org/data.json";
const API = "https://api.threesixtygiving.org/api/v1";

interface Dataset {
  publisher: { name: string; website?: string; org_id: string; prefix: string };
  license?: string;
  license_name?: string;
}
interface GrantRow {
  data: {
    title?: string;
    amountAwarded?: number;
    awardDate?: string;
    grantProgramme?: { title?: string }[];
    recipientIndividual?: unknown;
    beneficiaryLocation?: { name?: string }[];
  };
}

export const threesixty: Connector = {
  id: "threesixty",
  name: "360Giving registry and API",
  licence: "Each publisher's open licence (mostly CC BY 4.0); attribute the publisher",
  async run({ fetch, log, save }) {
    const json = async <T>(url: string): Promise<T> => {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    };
    const datasets = await json<Dataset[]>(REGISTRY);
    const publishers = [...new Map(datasets.map((d) => [d.publisher.org_id, d])).values()];
    log(`${publishers.length} publishers in the registry`);

    const funders = [];
    for (const d of publishers) {
      try {
        // A sample of the most recent grants is enough to tell whether a funder helps individuals.
        const page = await json<{ count: number; results: GrantRow[] }>(`${API}/org/${encodeURIComponent(d.publisher.org_id)}/grants_made/?limit=200`);
        const toPeople = page.results.filter((g) => g.data.recipientIndividual !== undefined);
        if (!toPeople.length) continue;
        const amounts = toPeople.map((g) => g.data.amountAwarded ?? 0).filter((a) => a > 0).sort((a, b) => a - b);
        const programmes = [...new Set(toPeople.flatMap((g) => g.data.grantProgramme?.map((p) => p.title ?? "") ?? []).filter(Boolean))].slice(0, 6);
        const places = [...new Set(toPeople.flatMap((g) => g.data.beneficiaryLocation?.map((l) => l.name ?? "") ?? []).filter(Boolean))].slice(0, 8);
        funders.push({
          name: d.publisher.name,
          orgId: d.publisher.org_id,
          website: d.publisher.website ?? null,
          licence: d.license_name ?? d.license ?? null,
          sampled: page.results.length,
          toIndividuals: toPeople.length,
          medianAward: amounts.length ? amounts[Math.floor(amounts.length / 2)] : null,
          latest: toPeople.map((g) => g.data.awardDate ?? "").sort().at(-1) ?? null,
          programmes,
          places,
        });
      } catch (e) {
        log(`skip ${d.publisher.name}: ${(e as Error).message}`);
      }
    }
    funders.sort((a, b) => b.toIndividuals - a.toIndividuals);
    await save("threesixty-individual-funders.json", { source: REGISTRY, api: API, read: new Date().toISOString().slice(0, 10), funders });
    log(`${funders.length} funders make grants to individuals`);
    return { items: funders.length };
  },
};
