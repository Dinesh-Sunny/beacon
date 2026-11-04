// Review: turns Muse Spark's drafts into pack schemes and sorts them, with no model and no
// network, so it can run anywhere and be re-run whenever the engine changes.
//   ready      - validates against the live SchemeSchema and needs only facts Beacon asks
//   needsFacts - valid shape, but the page depends on something Beacon doesn't ask yet
//   invalid    - didn't validate (the issues are listed)
//   duplicate  - the same page, or the same id, is already in a live pack

import type { z } from "zod";
import { type Pack, SchemeSchema } from "../engine/pack.ts";
import { Draft, type DraftT } from "./draft-schema.ts";

export interface DraftFile {
  [url: string]: {
    url: string;
    provider: string | null;
    draft?: unknown;
    problems: string[];
  };
}
export type ReviewStatus = "ready" | "needsFacts" | "invalid" | "duplicate";
export interface Reviewed {
  /** Missing facts mapped to proposed question ids, after dropping generic claim conditions. */
  wants: string[];
  url: string;
  provider: string;
  status: ReviewStatus;
  name: string;
  missingFacts: string[];
  issues: string[];
  scheme?: z.infer<typeof SchemeSchema>;
}

/** Conditions every claim has (residence, paperwork, how to apply). Screening can't ask them and doesn't need to. */
const GENERIC =
  /resid|immigra|nationalit|right to work|living in the uk|notice|proof|evidence|form|apply|application|identity|bank account details/i;

/** Proposed new questions (from catalog/coverage.json) and the words that point at each. */
export const FACT_HINTS: Record<string, RegExp> = {
  childDisabled: /disabled child|child.*(disab|dla|pip)/i,
  childCount: /(two|three|3|2|number of) (or more )?child/i,
  inEducation:
    /full-time (education|study)|student|studying|course|college|university|school/i,
  veteran: /armed forces|veteran|served in|service personnel|reserv/i,
  waterMeter: /water meter/i,
  epc: /energy (performance|rating)|epc|insulation|heating system|boiler|heat pump/i,
  homeAdapt: /adapt|disabled facilities/i,
  redundant: /redundan|lost (your|their) job|dismiss/i,
  sickOff: /off sick|sick pay|unable to work/i,
  workInjury: /injur(y|ed) at work|industrial (disease|injur)/i,
  pensionPot: /pension (pot|scheme)|workplace pension|lost pension/i,
  oldAccounts: /dormant|old (bank|account)|child trust fund/i,
  crimeVictim: /victim of (a )?crime|criminal injur/i,
  legalIssue: /court|tribunal|legal/i,
  hourlyPay: /hourly|minimum wage|pay rate/i,
  jobCosts: /work(ing)? costs|uniform|tools|travel to work/i,
  conditionList: /medical condition|diagnos|illness|cancer|diabetes|terminal/i,
  carer: /caring|carer/i,
  employer: /employer|employed by|your job|work in/i,
};

const pageKey = (url: string) => {
  const u = new URL(url);
  return `${u.hostname}/${u.pathname.split("/").filter(Boolean)[0] ?? ""}`;
};

export function toScheme(d: DraftT, url: string, topic: string): unknown {
  const nationRule =
    d.nations.length && d.nations.length < 4
      ? [
          {
            needs: ["postcode"],
            test: { f: "nation", op: "in", v: d.nations },
            expr: `lives in ${d.nations.join(", ")}`,
            txt: "Lives where this is offered",
            fail: "Not offered where they live",
          },
        ]
      : [];
  const rule = [
    ...nationRule,
    ...d.conditions.map((c) => {
      const parts = c.anyOf.map((x) =>
        x.op === "in"
          ? {
              f: x.f,
              op: "in",
              v: (Array.isArray(x.v) ? x.v : [x.v]).map(String),
            }
          : x,
      );
      return {
        needs: c.needs,
        test: parts.length === 1 ? parts[0] : { any: parts },
        expr: c.txt.toLowerCase().replace(/\.$/, ""),
        txt: c.txt.replace(/\.$/, ""),
        fail: c.fail.replace(/\.$/, ""),
      };
    }),
  ];
  return {
    id: d.id,
    name: d.name,
    topic,
    by: /^https?:/.test(d.by) ? "See the official page" : d.by,
    gives: d.gives,
    how: d.how,
    url,
    ...(d.auto ? { auto: true } : {}),
    ...(d.worthChecking ? { worthChecking: d.worthChecking } : {}),
    rule: rule.length
      ? rule
      : [
          {
            needs: ["postcode"],
            test: { f: "nation", op: "in", v: ["eng", "sco", "wal", "ni"] },
            expr: "lives in the UK",
            txt: "Lives in the UK",
            fail: "Not offered where they live",
          },
        ],
  };
}

/** Which proposed question would make the most drafts ready: the data-driven question roadmap. */
export function factRoadmap(
  rows: Reviewed[],
): { fact: string; unlocks: number; alsoNeeds: number }[] {
  const counts = new Map<string, { unlocks: number; alsoNeeds: number }>();
  for (const r of rows.filter((x) => x.status === "needsFacts")) {
    for (const f of r.wants) {
      const c = counts.get(f) ?? { unlocks: 0, alsoNeeds: 0 };
      if (r.wants.length === 1) c.unlocks++;
      else c.alsoNeeds++;
      counts.set(f, c);
    }
  }
  return [...counts.entries()]
    .map(([fact, c]) => ({ fact, ...c }))
    .sort((a, b) => b.unlocks - a.unlocks || b.alsoNeeds - a.alsoNeeds);
}

export function review(drafts: DraftFile, packs: Pack[]): Reviewed[] {
  const liveIds = new Set(packs.flatMap((p) => p.schemes.map((s) => s.id)));
  const livePages = new Set(
    packs.flatMap((p) => p.schemes.map((s) => pageKey(s.url))),
  );
  const seen = new Set<string>();
  return Object.values(drafts).map((row): Reviewed => {
    const base = {
      url: row.url,
      provider: row.provider ?? "other",
      name: "",
      missingFacts: [] as string[],
      wants: [] as string[],
      issues: [...row.problems.filter((p) => !p.includes("safeParse"))],
    };
    const parsed = Draft.safeParse(row.draft);
    if (row.draft === undefined)
      return {
        ...base,
        status: "invalid",
        issues: base.issues.length ? base.issues : ["model call failed"],
      };
    if (!parsed.success)
      return {
        ...base,
        status: "invalid",
        issues: [
          ...base.issues,
          ...parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`,
          ),
        ],
      };
    const d = parsed.data;
    const specific = d.missingFacts.filter((m) => !GENERIC.test(m));
    const wants = [
      ...new Set(
        specific.flatMap(
          (m) =>
            Object.entries(FACT_HINTS)
              .filter(([, re]) => re.test(m))
              .map(([id]) => id) || [],
        ),
      ),
    ];
    const unmapped = specific.filter(
      (m) => !Object.values(FACT_HINTS).some((re) => re.test(m)),
    );
    const out = {
      ...base,
      name: d.name,
      missingFacts: specific,
      wants: unmapped.length ? [...wants, "other"] : wants,
    };
    if (livePages.has(pageKey(row.url)) || liveIds.has(d.id))
      return { ...out, status: "duplicate" };
    let id = d.id;
    for (let n = 2; seen.has(id); n++)
      id = `${d.id.replace(/\d+$/, "")}${"abcdefghij"[n] ?? "z"}`;
    seen.add(id);
    // Quality gates: a real name, a real offer, and at least one condition that targets someone.
    // Help everyone gets (a library card, a recycling bin) is a service, not something to find.
    const gates = [
      d.name.trim().length < 4 && "name is missing",
      d.gives.trim().length < 12 && "doesn't say what it gives",
      !d.conditions.length &&
        !d.worthChecking &&
        "applies to everyone, so it's a service rather than help to find",
    ].filter((x): x is string => Boolean(x));
    if (gates.length) return { ...out, status: "invalid", issues: gates };
    const scheme = SchemeSchema.safeParse(
      toScheme({ ...d, id }, row.url, base.provider),
    );
    if (!scheme.success)
      return {
        ...out,
        status: "invalid",
        issues: scheme.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      };
    return {
      ...out,
      status: specific.length ? "needsFacts" : "ready",
      scheme: scheme.data,
    };
  });
}
