import "server-only";

// ZIP code to US state, city and county. Zippopotam.us gives the state and a point; the FCC's
// Census Area API turns the point into the county (FIPS), which local datasets are keyed by.
// Both are free and open. Cached by a hash of the ZIP for a day; nothing about the person is kept.

import { z } from "zod";
import { cached, keyOf, Lru } from "./cache";

const UA = "Beacon (+https://github.com/Dinesh-Sunny/beacon)";
const Zippo = z.object({
  places: z
    .array(
      z.object({
        "place name": z.string(),
        "state abbreviation": z.string().length(2),
        state: z.string(),
        latitude: z.string(),
        longitude: z.string(),
      }),
    )
    .min(1),
});
const Fcc = z.object({
  results: z.array(
    z.object({ county_fips: z.string(), county_name: z.string() }),
  ),
});

export type UsPlace = {
  state: string | null;
  stateName: string | null;
  city: string | null;
  county: { fips: string; name: string } | null;
  /** The ZIP code's centre, for finding the nearest help. */
  lat: number | null;
  lon: number | null;
};
const NONE: UsPlace = {
  state: null,
  stateName: null,
  city: null,
  county: null,
  lat: null,
  lon: null,
};

const cache = new Lru<UsPlace>(5000, 24 * 60 * 60 * 1000);
const inflight = new Map<string, Promise<UsPlace>>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${new URL(url).host}`);
  return res.json();
}

export async function usPlaceFor(zip: string): Promise<UsPlace> {
  const { value } = await cached(
    cache,
    inflight,
    keyOf({ zip, v: 2 }),
    async () => {
      const z1 = Zippo.safeParse(
        await getJson(`https://api.zippopotam.us/us/${zip}`),
      );
      if (!z1.success) return NONE;
      const p = z1.data.places[0];
      if (!p) return NONE;
      let county: UsPlace["county"] = null;
      try {
        const f = Fcc.safeParse(
          await getJson(
            `https://geo.fcc.gov/api/census/area?lat=${encodeURIComponent(p.latitude)}&lon=${encodeURIComponent(p.longitude)}&format=json`,
          ),
        );
        const r = f.success ? f.data.results[0] : undefined;
        if (r) county = { fips: r.county_fips, name: r.county_name };
      } catch {
        /* the state alone still decides most programs */
      }
      return {
        state: p["state abbreviation"],
        stateName: p.state,
        city: p["place name"],
        county,
        lat: Number(p.latitude) || null,
        lon: Number(p.longitude) || null,
      };
    },
  );
  return value;
}
