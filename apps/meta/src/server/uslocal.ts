import "server-only";

// US local help near a ZIP code: HRSA health centers, HUD housing agencies and HUD-approved
// housing counselors (src/data/us-local.json, built by scripts/us-local.ts), nearest first.
// Only the ZIP code's centre is used; nothing is stored.

import DATA from "@/data/us-local.json";

type Row = [
  string,
  string,
  string,
  string,
  string | null,
  string | null,
  number,
  number,
  string,
];
type Kind = "c" | "h" | "k";
const STATES = DATA.states as unknown as Record<string, Record<Kind, Row[]>>;

export interface UsService {
  name: string;
  address: string;
  phone: string | null;
  web: string | null;
  miles: number;
  /** Health centers: "mobile" or "seasonal". Agencies: "public", "vouchers" or "both".
   * Counselors: what they help with and other languages spoken. */
  note: string;
}

const miles = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};

/** The nearest few of one kind: from the state first, then from across a state line if closer. */
function nearest(
  kind: Kind,
  state: string,
  lat: number,
  lon: number,
  n: number,
): UsService[] {
  const pool = Object.entries(STATES).flatMap(([st, k]) =>
    st === state
      ? k[kind]
      : // A state line is often closer than the state's own services; agencies only serve
        // their own state, so only health centers and counselors cross it.
        kind === "h"
        ? []
        : k[kind],
  );
  return pool
    .map((r) => ({ r, m: miles(lat, lon, r[6], r[7]) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map(({ r, m }) => ({
      name: r[0],
      address: [r[1], r[2], r[3]].filter(Boolean).join(", "),
      phone: r[4],
      web: r[5],
      miles: Math.round(m * 10) / 10,
      note: r[8],
    }));
}

export interface UsLocal {
  health: UsService[];
  housing: UsService[];
  counselors: UsService[];
  /** How many of each the state has, for "N in your state". */
  inState: Record<"health" | "housing" | "counselors", number>;
}

export function usLocalFor(state: string, lat: number, lon: number): UsLocal {
  const here = STATES[state];
  return {
    health: nearest("c", state, lat, lon, 5),
    housing: nearest("h", state, lat, lon, 3),
    counselors: nearest("k", state, lat, lon, 3),
    inState: {
      health: here?.c.length ?? 0,
      housing: here?.h.length ?? 0,
      counselors: here?.k.length ?? 0,
    },
  };
}
