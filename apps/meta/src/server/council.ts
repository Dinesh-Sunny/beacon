import "server-only";

// Postcode to place: the council (GOV.UK's local authority lookup) and the nation (postcodes.io,
// which knows the exact country for postcodes near a border). Councils run hundreds of local
// services and GOV.UK routes each one to the right council's own page, so knowing the council
// turns "ask your council" into a direct link. Cached by a hash of the postcode for a day;
// nothing about the person is stored.

import { z } from "zod";
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
  result: z.object({ country: z.string() }).nullable(),
});
const COUNTRY: Record<string, Nation> = {
  England: "eng",
  Scotland: "sco",
  Wales: "wal",
  "Northern Ireland": "ni",
};

export type Council = { name: string; slug: string; homepage?: string };
export type Place = { council: Council | null; nation: Nation | null };

const cache = new Lru<Place>(5000, 24 * 60 * 60 * 1000);
const inflight = new Map<string, Promise<Place>>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`${res.status} ${new URL(url).host}`);
  return res.json();
}

export async function placeFor(postcode: string): Promise<Place> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const { value } = await cached(cache, inflight, keyOf({ pc }), async () => {
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
    const country =
      pio.status === "fulfilled"
        ? PostcodesIo.safeParse(pio.value).data?.result?.country
        : undefined;
    return {
      council: a
        ? { name: a.name, slug: a.slug, homepage: a.homepage_url }
        : null,
      nation: (country && COUNTRY[country]) || null,
    };
  });
  return value;
}
