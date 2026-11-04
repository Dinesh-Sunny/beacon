import "server-only";

// Postcode to council, through GOV.UK's local authority lookup. Councils run hundreds of local
// services, and GOV.UK routes each one to the right council's own page, so knowing the council
// turns "ask your council" into a direct link for every council in the country.
// Cached by a hash of the postcode for a day; nothing about the person is stored.

import { z } from "zod";
import { cached, keyOf, Lru } from "./cache";

const Authority = z.object({
  name: z.string(),
  slug: z.string(),
  homepage_url: z.string().optional(),
  tier: z.string().optional(),
});
const Reply = z.object({
  local_authority: Authority.optional(),
  addresses: z
    .array(z.object({ name: z.string(), slug: z.string() }))
    .optional(),
});
export type Council = { name: string; slug: string; homepage?: string };

const cache = new Lru<Council | null>(5000, 24 * 60 * 60 * 1000);
const inflight = new Map<string, Promise<Council | null>>();

export async function councilFor(
  postcode: string,
): Promise<{ council: Council | null; cached: boolean }> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const { value, hit } = await cached(
    cache,
    inflight,
    keyOf({ pc }),
    async () => {
      const res = await fetch(
        `https://www.gov.uk/api/local-authority?postcode=${encodeURIComponent(pc)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Beacon (+https://github.com/Dinesh-Sunny/beacon)",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`council lookup ${res.status}`);
      const r = Reply.parse(await res.json());
      // A postcode split across councils comes back as a list; the person picks later, so say nothing.
      const a = r.local_authority;
      return a
        ? { name: a.name, slug: a.slug, homepage: a.homepage_url }
        : null;
    },
  );
  return { council: value, cached: hit };
}
