import "server-only";

// Postcode to place: the council (GOV.UK's local authority lookup) and the nation (postcodes.io,
// which knows the exact country for postcodes near a border). Councils run hundreds of local
// services and GOV.UK routes each one to the right council's own page, so knowing the council
// turns "ask your council" into a direct link. Cached by a hash of the postcode for a day;
// nothing about the person is stored.

import { z } from "zod";
import LINKS from "@/data/council-links.json";
import type { Nation } from "@/engine/rules";
import { cached, keyOf, Lru } from "./cache";

const UA = "Beacon (+https://github.com/Dinesh-Sunny/beacon)";
const GovUk = z.object({
  local_authority: z
    .object({
      name: z.string(),
      slug: z.string(),
      homepage_url: z.string().optional(),
    })
    .optional(),
});
const PostcodesIo = z.object({
  result: z
    .object({
      country: z.string(),
      admin_district: z.string().nullable().optional(),
      admin_county: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      codes: z
        .object({
          admin_district: z.string().optional(),
          admin_county: z.string().optional(),
        })
        .optional(),
    })
    .nullable(),
});
const COUNTRY: Record<string, Nation> = {
  England: "eng",
  Scotland: "sco",
  Wales: "wal",
  "Northern Ireland": "ni",
};

export type Council = { name: string; slug: string; homepage?: string };
/** One of the council's own pages for a local service, from GOV.UK Local Links Manager. */
export type LocalLink = {
  lgsl: string;
  label: string;
  people: string[];
  scheme?: string;
  url: string;
  by: string;
};
export type Place = {
  council: Council | null;
  nation: Nation | null;
  local: LocalLink[];
  /** District, county and region names, for matching local charities. */
  areas: string[];
};

const SERVICES = LINKS.services as Record<
  string,
  { label: string; people: string[]; scheme?: string }
>;
const COUNCILS = LINKS.councils as Record<
  string,
  { name: string; links: Record<string, string> }
>;

/** "Glasgow City Council", "Glasgow City" and "City of Glasgow" all key as "glasgow". */
const nameKey = (n: string) =>
  n
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(
      /\b(council|city|of|the|london|royal|borough|metropolitan|county|district|comhairle)\b/g,
      "",
    )
    .replace(/[^a-z]+/g, "");
const BY_NAME = new Map(
  Object.values(COUNCILS).map((c) => [nameKey(c.name), c] as const),
);

/** Every listed service from the district and, in two-tier areas, the county above it. Matched
 * by GSS code, then by name, since some councils were recoded after boundary changes. */
export function localLinks(
  areas: { code?: string; name?: string | null }[],
): LocalLink[] {
  const out: LocalLink[] = [];
  for (const a of areas) {
    const c =
      (a.code ? COUNCILS[a.code] : undefined) ??
      (a.name ? BY_NAME.get(nameKey(a.name)) : undefined);
    if (!c) continue;
    for (const [lgsl, url] of Object.entries(c.links)) {
      const s = SERVICES[lgsl];
      if (s && !out.some((o) => o.lgsl === lgsl))
        out.push({ lgsl, ...s, url, by: c.name });
    }
  }
  return out;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`${res.status} ${new URL(url).host}`);
  return res.json();
}

/** What the lookups say about a postcode. Only this is cached; anything built from Beacon's own
 * data (council pages) is worked out per request, so a data rebuild shows at once. */
type Lookup = {
  council: Council | null;
  nation: Nation | null;
  areas: { code?: string; name?: string | null }[];
  region: string | null;
};
const lookups = new Lru<Lookup>(5000, 24 * 60 * 60 * 1000);
const lookupsInflight = new Map<string, Promise<Lookup>>();

export async function placeFor(postcode: string): Promise<Place> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const { value: l } = await cached(
    lookups,
    lookupsInflight,
    keyOf({ pc }),
    async () => {
      // Either source can be down; each answer stands on its own.
      const [gov, pio] = await Promise.allSettled([
        getJson(
          `https://www.gov.uk/api/local-authority?postcode=${encodeURIComponent(pc)}`,
        ),
        getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`),
      ]);
      const a =
        gov.status === "fulfilled"
          ? GovUk.safeParse(gov.value).data?.local_authority
          : undefined;
      const r =
        pio.status === "fulfilled"
          ? PostcodesIo.safeParse(pio.value).data?.result
          : undefined;
      const country = r?.country;
      return {
        council: a
          ? { name: a.name, slug: a.slug, homepage: a.homepage_url }
          : null,
        nation: (country && COUNTRY[country]) || null,
        areas: [
          { code: r?.codes?.admin_district, name: r?.admin_district },
          { code: r?.codes?.admin_county, name: r?.admin_county },
        ],
        region: r?.region ?? null,
      };
    },
  );
  return {
    council: l.council,
    nation: l.nation,
    local: localLinks(l.areas),
    areas: [...l.areas.map((x) => x.name), l.region].filter(
      (x): x is string => !!x,
    ),
  };
}
