import "server-only";

// Grant-giving charities from the Charity Commission register, matched to where someone lives
// (their district, county and region) and to the Beacon Framework people groups their answers
// place them in. Local funds first, then ones that cover the whole nation. Nothing is stored.

import DATA from "@/data/charity-funds.json";

export interface Fund {
  n: string;
  name: string;
  web: string | null;
  does: string;
  income: number;
  /** Its own description says it helps people in need with money or grants. */
  need: boolean;
  what: string;
  who: string;
  local: string[];
  wide: string[];
}
const FUNDS = DATA.funds as Fund[];

// Which register tags speak to each people group.
const FIT: Record<string, { who: string; what: string }> = {
  older: { who: "e", what: "p" },
  disabled: { who: "d", what: "dh" },
  carers: { who: "d", what: "dh" },
  families: { who: "c", what: "pt" },
  young: { who: "c", what: "t" },
  outofwork: { who: "", what: "pa" },
  lowpay: { who: "", what: "pa" },
  events: { who: "", what: "p" },
};

const byArea = new Map<string, Fund[]>();
for (const f of FUNDS)
  for (const a of [...f.local, ...f.wide]) {
    const k = a.toLowerCase();
    byArea.set(k, [...(byArea.get(k) ?? []), f]);
  }

function score(f: Fund, groups: string[]): number {
  let s = f.need ? 3 : 0;
  for (const g of groups) {
    const fit = FIT[g];
    if (!fit) continue;
    if ([...fit.who].some((c) => f.who.includes(c))) s += 2;
    if ([...fit.what].some((c) => f.what.includes(c))) s += 1;
  }
  return s;
}

export interface Where {
  areas: string[];
  nation: string | null;
}

/** Up to `local` funds for the person's own areas and `wide` that cover their nation. */
export function fundsFor(
  where: Where,
  groups: string[],
  { local = 6, wide = 4 } = {},
): { local: Fund[]; wide: Fund[]; read: string; source: string } {
  const rank = (list: Fund[]) =>
    list
      .map((f) => ({ f, s: score(f, groups) }))
      .filter((x) => x.s > (x.f.need ? 3 : 0))
      // Closest fit first, then the larger funds, which tend to give more often.
      .sort((a, b) => b.s - a.s || b.f.income - a.f.income)
      .map((x) => x.f);
  const near = [
    ...new Set(where.areas.flatMap((a) => byArea.get(a.toLowerCase()) ?? [])),
  ];
  const nationWide = where.nation ? (byArea.get(where.nation) ?? []) : [];
  const londonWide = where.areas.some((a) => /^london$/i.test(a))
    ? (byArea.get("london") ?? [])
    : [];
  const localList = rank(near.filter((f) => f.local.length)).slice(0, local);
  const seen = new Set(localList);
  // Nationwide lists are long, so only funds that say they help people in need make the cut.
  const wideList = rank([...londonWide, ...nationWide].filter((f) => f.need))
    .filter((f) => !seen.has(f))
    .slice(0, wide);
  return {
    local: localList,
    wide: wideList,
    read: DATA.read,
    source: DATA.source,
  };
}
