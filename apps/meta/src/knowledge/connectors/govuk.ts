// GOV.UK: the biggest aggregator of UK public help. Walks the mainstream browse sections
// (benefits, disability, childcare, bereavement, housing and more) through the Content API,
// then lists every page tagged to each section through the Search API in one call per section.
// Output: catalog/harvest/govuk.json, one row per page, and stored text for new pages.

import type { Connector } from "./types.ts";

const ROOTS = ["benefits", "disabilities", "childcare-parenting", "births-deaths-marriages", "housing-local-services", "working", "education", "tax", "driving"];
const FORMATS = new Set(["guide", "transaction", "answer", "simple_smart_answer", "local_transaction", "place", "calculator"]);

interface SearchRow {
  title: string;
  link: string;
  description?: string;
  format?: string;
  public_timestamp?: string;
}

export const govuk: Connector = {
  id: "govuk",
  name: "GOV.UK Content and Search APIs",
  licence: "Open Government Licence v3.0",
  async run({ fetch, log, save, store }) {
    const json = async <T>(url: string): Promise<T> => {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    };
    const sections: { root: string; path: string; title: string }[] = [];
    for (const root of ROOTS) {
      try {
        const page = await json<{ title: string; links?: { children?: { base_path: string; title: string }[] } }>(`https://www.gov.uk/api/content/browse/${root}`);
        const kids = page.links?.children ?? [];
        if (!kids.length) sections.push({ root, path: `/browse/${root}`, title: page.title });
        for (const k of kids) sections.push({ root, path: k.base_path, title: k.title });
      } catch (e) {
        log(`skip ${root}: ${(e as Error).message}`);
      }
    }
    log(`${sections.length} sections`);

    const pages = new Map<string, SearchRow & { sections: string[] }>();
    for (const s of sections) {
      const value = s.path.replace(/^\/browse\//, "");
      const url = `https://www.gov.uk/api/search.json?filter_mainstream_browse_pages=${encodeURIComponent(value)}&count=1500&fields=title,link,description,format,public_timestamp`;
      try {
        const { results } = await json<{ results: SearchRow[] }>(url);
        for (const r of results) {
          if (r.format && !FORMATS.has(r.format)) continue;
          const key = `https://www.gov.uk${r.link}`;
          const row = pages.get(key) ?? { ...r, sections: [] };
          row.sections.push(s.title);
          pages.set(key, row);
        }
      } catch (e) {
        log(`search failed for ${value}: ${(e as Error).message}`);
      }
    }
    const rows = [...pages.entries()]
      .map(([url, r]) => ({ url, title: r.title, description: r.description ?? "", format: r.format ?? null, updated: r.public_timestamp ?? null, sections: [...new Set(r.sections)] }))
      .sort((a, b) => a.url.localeCompare(b.url));
    await save("govuk.json", { connector: "govuk", sections, pages: rows });
    log(`${rows.length} pages listed`);
    const stored = await store(rows.map((r) => r.url));
    log(`stored text: ${stored.added.length} new, ${stored.skipped.length} already kept, ${stored.failed.length} failed`);
    return { items: rows.length };
  },
};
