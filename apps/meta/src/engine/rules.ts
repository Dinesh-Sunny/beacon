// The rules engine: derived facts, three-valued evaluation over a rule pack (packs/*.json), the
// question planner, the claim order and clash warnings. Plain code decides; models only explain.
// It runs in the browser, so a check costs the server nothing until someone asks a model for help.

import ukBills from "../../packs/uk-bills.json";
import ukCharity from "../../packs/uk-charity.json";
import ukCore from "../../packs/uk-core.json";
import ukCouncil from "../../packs/uk-council.json";
import ukFamily from "../../packs/uk-family.json";
import ukHealth from "../../packs/uk-health.json";
import ukHousehold from "../../packs/uk-household.json";
import ukScotland from "../../packs/uk-scotland.json";
import ukUnclaimed from "../../packs/uk-unclaimed.json";
import ukWorkCare from "../../packs/uk-work-care.json";
import usFederal from "../../packs/us-federal.json";
import {
  type Answers,
  FACTS,
  type FactId,
  moneyText,
  ORDER,
  UNSURE,
} from "./facts.ts";
import {
  type Cond,
  type DerivedValues,
  type PackedScheme,
  RegistrySchema,
  run,
  type Topic,
} from "./pack.ts";

// ---------- Derived facts ----------
const SCOTLAND = [
  "AB",
  "DD",
  "DG",
  "EH",
  "FK",
  "G",
  "HS",
  "IV",
  "KA",
  "KW",
  "KY",
  "ML",
  "PA",
  "PH",
  "TD",
  "ZE",
];
const WALES = ["CF", "LD", "LL", "NP", "SA"];
export type Nation = "eng" | "sco" | "wal" | "ni";
export const NATION: Record<Nation, string> = {
  eng: "England",
  sco: "Scotland",
  wal: "Wales",
  ni: "Northern Ireland",
};

export const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/;

export function nationOf(pc: string): Nation | null {
  const m = /^([A-Z]{1,2})\d/.exec(pc.replace(/\s/g, "").toUpperCase());
  if (!m?.[1]) return null;
  const area = m[1];
  if (area === "BT") return "ni";
  if (SCOTLAND.includes(area)) return "sco";
  if (WALES.includes(area)) return "wal";
  return "eng";
}

export function ageOn(d: Date, on: Date): number {
  let a = on.getFullYear() - d.getFullYear();
  if (
    on.getMonth() < d.getMonth() ||
    (on.getMonth() === d.getMonth() && on.getDate() < d.getDate())
  )
    a--;
  return a;
}

function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

/** State Pension age: 66 before 6 Apr 1960, rising by a month at a time to 67 by 6 Mar 1961. */
export function spaDate(d: Date): { date: Date; label: string } {
  const start = new Date(1960, 3, 6);
  const end = new Date(1961, 2, 6);
  if (d < start) return { date: addMonths(d, 66 * 12), label: "66" };
  if (d < end) {
    let n = 0;
    while (addMonths(start, n + 1) <= d) n++;
    return {
      date: addMonths(d, 66 * 12 + n + 1),
      label: `66 and ${n + 1} month${n ? "s" : ""}`,
    };
  }
  return { date: addMonths(d, 67 * 12), label: "67" };
}

const PER = { week: 1, month: 12 / 52, year: 1 / 52 } as const;
/** "No children" as an age no child rule can match (JSON has no Infinity). */
export const NO_CHILD = 999;

export interface Derived {
  nation?: Nation | null;
  age?: number;
  spa?: boolean;
  spaLabel?: string;
  gateway?: boolean;
  incWeek?: number;
  incYear?: number;
  sav?: number;
  health?: "none" | "daily" | "care";
  move?: boolean;
  work?: string;
  hours?: number;
  lowWork?: boolean;
  ni?: boolean;
  childAge?: number;
  pregnant?: boolean;
  careHours?: number;
  ctax?: boolean;
  bereaved?: string;
  housing?: string;
  uc?: boolean;
  pc?: boolean;
  /** Dates as YYYYMMDD numbers, so rules can test birth date windows like the Child Trust Fund's. */
  bornOn?: number;
  childBornOn?: number;
  /** No other adults at home (children under 18 don't count, as for the council tax discount). */
  livesAlone?: boolean;
  couple?: boolean;
  debt?: boolean;
  /** Whose rules apply: "GB" unless the place dialog chose another country. */
  country?: string;
  /** United States: state, household size, income as a share of the poverty guideline. */
  state?: string;
  people?: number;
  fplPct?: number;
  usGateway?: boolean;
  snap?: boolean;
  medicaid?: boolean;
  ssi?: boolean;
  veteran?: boolean;
}

const dateNum = (iso: string) => Number(iso.slice(0, 10).replaceAll("-", ""));

const isSet = <T>(v: T | undefined | typeof UNSURE): v is T =>
  v !== undefined && v !== UNSURE;

export function derive(A: Answers, today = new Date()): Derived {
  const d: Derived = {};
  // A looked-up nation wins over the postcode letters, which can be wrong near a border.
  if (isSet(A.postcode)) d.nation = A.nation ?? nationOf(A.postcode);
  if (isSet(A.dob)) {
    const b = new Date(A.dob);
    d.age = ageOn(b, today);
    const s = spaDate(b);
    d.spa = today >= s.date;
    d.spaLabel = s.label;
    if (!A.dobApprox) d.bornOn = dateNum(A.dob);
  }
  if (isSet(A.benefits)) {
    d.uc = A.benefits.includes("uc");
    d.pc = A.benefits.includes("pc");
    d.gateway = d.uc || d.pc;
  }
  if (isSet(A.income)) {
    d.incWeek = Math.round(A.income.amt * PER[A.income.per]);
    d.incYear = d.incWeek * 52;
  }
  if (isSet(A.savings)) d.sav = A.savings;
  if (isSet(A.difficulties)) {
    const x = A.difficulties;
    d.health =
      x.includes("wash") || x.includes("night")
        ? "care"
        : x.length
          ? "daily"
          : "none";
    d.move = x.includes("move");
  }
  if (isSet(A.work)) {
    d.work = A.work.status;
    d.hours = A.work.hours ?? 0;
    d.lowWork =
      d.work === "none" ||
      d.work === "sick" ||
      (d.work === "employed" && d.hours < 16);
  }
  if (isSet(A.ni)) d.ni = A.ni === "yes";
  if (isSet(A.child))
    d.childAge =
      A.child === "none" ? NO_CHILD : ageOn(new Date(A.child), today);
  if (isSet(A.child) && A.child !== "none") d.childBornOn = dateNum(A.child);
  if (isSet(A.pregnant)) d.pregnant = A.pregnant === "yes";
  if (isSet(A.careHours)) d.careHours = A.careHours;
  if (isSet(A.ctax)) d.ctax = A.ctax === "yes";
  if (isSet(A.bereaved)) d.bereaved = A.bereaved;
  if (isSet(A.housing)) d.housing = A.housing;
  if (isSet(A.household)) {
    d.livesAlone = A.household === "alone" || A.household === "children";
    d.couple = A.household === "partner";
  }
  if (isSet(A.debt)) d.debt = A.debt === "yes";
  d.country = A.country ?? "GB";
  if (A.state) d.state = A.state;
  if (isSet(A.people)) d.people = A.people;
  if (isSet(A.benefitsUs)) {
    d.snap = A.benefitsUs.includes("snap");
    d.medicaid = A.benefitsUs.includes("medicaid");
    d.ssi = A.benefitsUs.includes("ssi");
    d.usGateway =
      d.snap || d.medicaid || d.ssi || A.benefitsUs.includes("tanf");
  }
  if (isSet(A.veteran)) d.veteran = A.veteran === "yes";
  // Income as a share of the federal poverty guideline for the household's size (the lines
  // come from the US pack; Alaska and Hawaii have their own).
  if (d.incYear !== undefined && d.people !== undefined) {
    const sfx = d.state === "AK" ? "AK" : d.state === "HI" ? "HI" : "";
    const base = LINES[`fplBase${sfx}`]?.value;
    const add = LINES[`fplAdd${sfx}`]?.value;
    if (base && add)
      d.fplPct = Math.round((d.incYear / (base + add * (d.people - 1))) * 100);
  }
  return d;
}

/** The nation someone lives in: a looked-up one if there is, else from the postcode. */
export const nationIn = (A: Answers): Nation | null => derive(A).nation ?? null;

/** Plain-English facts worked out from one answer, shown under the input as you type. */
/** What an answer tells Beacon, as message ids with values, so any language can word it. */
export type Chip = { id: ChipId; v?: Record<string, string | number> };
export type ChipId = keyof typeof CHIP_EN;
const CHIP_EN = {
  livesIn: "Lives in {nation}",
  age: "Age {age}",
  spa: "State Pension age {age}",
  pensionAge: "Pension age reached",
  workingAge: "Working age",
  perWeek: "{amount} a week",
  medicareAge: "Medicare age reached",
  noHelp: "No daily help needed",
  dailyHelp: "Daily living help",
  careHelp: "Personal care help",
  opens: "Opens linked help",
  noLinked: "No linked help yet",
  lowWork: "Under 16 hours or not working",
  fullWork: "16 hours or more",
  noChildren: "No children",
  youngest: "Youngest is {age}",
  care35: "35 hours or more",
  careUnder: "Under 35 hours",
} as const;

export function chips(f: FactId, d: Derived): Chip[] {
  const out: Chip[] = [];
  if (f === "postcode" && d.nation)
    out.push({ id: "livesIn", v: { nation: d.nation } });
  const us = d.country === "US";
  if (f === "dob" && d.age !== undefined) {
    out.push({ id: "age", v: { age: d.age } });
    // State Pension age is a UK line; in the US the line that matters most is Medicare at 65.
    if (us) {
      if (d.age >= 65) out.push({ id: "medicareAge" });
    } else {
      out.push({ id: "spa", v: { age: d.spaLabel ?? "" } });
      out.push({ id: d.spa ? "pensionAge" : "workingAge" });
    }
  }
  if (f === "income" && d.incWeek !== undefined)
    out.push({
      id: "perWeek",
      v: { amount: moneyText(Math.round(d.incWeek * 100) / 100, d.country) },
    });
  if (f === "difficulties" && d.health)
    out.push({
      id: ({ none: "noHelp", daily: "dailyHelp", care: "careHelp" } as const)[
        d.health
      ],
    });
  if (f === "benefits" && d.gateway !== undefined)
    out.push({ id: d.gateway ? "opens" : "noLinked" });
  // The 16-hour line is a UK rule.
  if (f === "work" && d.work && !us)
    out.push({ id: d.lowWork ? "lowWork" : "fullWork" });
  if (f === "child" && d.childAge !== undefined)
    out.push(
      d.childAge === NO_CHILD
        ? { id: "noChildren" }
        : { id: "youngest", v: { age: d.childAge } },
    );
  if (f === "careHours" && d.careHours !== undefined)
    out.push({ id: d.careHours >= 35 ? "care35" : "careUnder" });
  return out;
}

/** The English wording of a chip (the activity log and the agent read English). */
export const chipEn = (c: Chip): string =>
  CHIP_EN[c.id].replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = c.v?.[k];
    return k === "nation" ? NATION[v as Nation] : String(v ?? "");
  });

export const derivedChips = (f: FactId, d: Derived): string[] =>
  chips(f, d).map(chipEn);

// ---------- The packs ----------
// Load order is layer order: the core benefits first, then each group of help built on them.
// Adding a group is a new JSON file here; the registry check fails the build on any bad reference.
export const REGISTRY = RegistrySchema.parse([
  ukCore,
  ukBills,
  ukHealth,
  ukCouncil,
  ukFamily,
  ukScotland,
  ukWorkCare,
  ukUnclaimed,
  ukHousehold,
  ukCharity,
  usFederal,
]);
export type Scheme = PackedScheme;
export type { Cond, Topic };
export const LINES = REGISTRY.lines;
export const TOPICS = REGISTRY.topics;
export const SCHEMES: Scheme[] = REGISTRY.schemes;

/** "A, B and C". */
export const listJoin = (xs: string[]): string =>
  xs.length < 2
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** Nations the core benefits pack covers (its notCovered sends a nation elsewhere). Copy that
 * names the nations reads from here, so it stays true when a nation is added. */
export const COVERED_NATIONS = (Object.keys(NATION) as Nation[]).filter(
  (n) => !SCHEMES.some((s) => s.pack === "uk-core" && s.notCovered[n]),
);
export const COVERED_NATIONS_TXT = listJoin(
  COVERED_NATIONS.map((n) => NATION[n]),
);
export const byId: Record<string, Scheme> = Object.fromEntries(
  SCHEMES.map((s) => [s.id, s]),
);
export const GATEWAYS = REGISTRY.gateways;

/** Whether a scheme arrives without a claim where this person lives. */
export const isAuto = (s: Scheme, nation?: Nation | null): boolean =>
  Array.isArray(s.auto)
    ? Boolean(nation && s.auto.includes(nation))
    : Boolean(s.auto);

/** How to claim, in the version for the nation they live in. */
export const howFor = (s: Scheme, nation?: Nation | null): string =>
  (nation && s.local?.[nation]?.how) || s.how;
/** The timing note for their nation; an empty local timing hides it. */
export const timingFor = (
  s: Scheme,
  nation?: Nation | null,
): string | undefined => {
  const local = nation ? s.local?.[nation]?.timing : undefined;
  return local !== undefined ? local || undefined : s.timing;
};

// ---------- Framework groups ----------
/** Which of the Beacon Framework's people groups the answers place someone in. */
export function peopleGroups(A: Answers): string[] {
  const d = derive(A);
  const g: string[] = [];
  if (d.spa) g.push("older");
  if (d.health && d.health !== "none") g.push("disabled");
  if ((d.careHours ?? 0) > 0) g.push("carers");
  if ((d.childAge !== undefined && d.childAge !== NO_CHILD) || d.pregnant)
    g.push("families");
  if (d.age !== undefined && d.age < 25) g.push("young");
  if (d.work === "none" || d.work === "sick") g.push("outofwork");
  if (
    d.gateway ||
    (d.incWeek !== undefined && d.incWeek < (LINES.ucIncomeWeek?.value ?? 0)) ||
    d.debt
  )
    g.push("lowpay");
  if (d.bereaved && d.bereaved !== "no") g.push("events");
  return g;
}

// ---------- Value ----------
const PER_TXT = {
  week: " a week",
  month: " a month",
  year: " a year",
  once: " in total",
} as const;

/** A scheme's amount for this person: a top-up worked out from their income, or the published range. */
export function worthFor(
  s: Scheme,
  A: Answers,
): {
  min?: number;
  max: number;
  per: "week" | "month" | "year" | "once";
  topUp: boolean;
} | null {
  const w = s.worth;
  if (!w) return null;
  if (w.topUpTo) {
    const line = LINES[w.topUpTo.line]?.value;
    const inc = derive(A).incWeek;
    if (line === undefined || inc === undefined || inc >= line) return null;
    return {
      max: Math.round((line - inc) * 100) / 100,
      per: "week",
      topUp: true,
    };
  }
  return { min: w.min, max: w.max, per: w.per, topUp: false };
}

/** "£76.70 to £114.60 a week", or "About £28 a week" for a top-up from their own income. */
export function worthLabel(s: Scheme, A: Answers = {}): string | null {
  const w = worthFor(s, A);
  if (!w) return null;
  const m = (n: number) => moneyText(n, s.country);
  if (w.topUp)
    return `About ${m(w.max)}${PER_TXT[w.per]}, from the answers given`;
  return `${w.min ? `${m(w.min)} to ` : "Up to "}${m(w.max)}${PER_TXT[w.per]}`;
}

/** The most the likely regular payments add up to in a year, and one-off sums on top. */
export function worthTotals(
  st: States,
  A: Answers = {},
): { yearly: number; once: number; count: number } {
  let yearly = 0;
  let once = 0;
  let count = 0;
  for (const s of SCHEMES) {
    if (st[s.id]?.status !== "likely") continue;
    const w = worthFor(s, A);
    if (!w) continue;
    count++;
    if (w.per === "once") once += w.max;
    else yearly += w.max * { week: 52, month: 12, year: 1 }[w.per];
  }
  return { yearly: Math.round(yearly), once: Math.round(once), count };
}

// ---------- Evaluation ----------
export const RANK: Record<
  "have" | "likely" | "check" | "unlock" | "open" | "out",
  number
> = { likely: 0, check: 1, unlock: 2, have: 3, open: 4, out: 5 };
export type Status = "open" | "likely" | "check" | "unlock" | "out" | "have";

/** Answers to "Which of these do you already get?" and the schemes each one means. */
const ALREADY: Record<string, string[]> = {
  uc: ["uc"],
  pc: ["pc"],
  cb: ["cb"],
  pip: ["pip", "aa", "adp"],
};
/** The reverse: the "already get" answer an award of this scheme means, so an award opens what it unlocks. */
export const BENEFIT_OF: Record<string, string> = Object.fromEntries(
  Object.entries(ALREADY).flatMap(([b, ids]) => ids.map((id) => [id, b])),
);
/** The same for US programs (the benefitsUs answer); each option is its own scheme id. */
const ALREADY_US: Record<string, string[]> = {
  snap: ["snap"],
  medicaid: ["medicaid"],
  ssi: ["ssi"],
  tanf: ["tanf"],
  wic: ["wic"],
  ssdi: ["ssdi"],
};
export const BENEFIT_OF_US: Record<string, string> = Object.fromEntries(
  Object.entries(ALREADY_US).flatMap(([b, ids]) => ids.map((id) => [id, b])),
);

/** How to challenge a refusal for this scheme, if the packs say. */
export const challengeFor = (s: Scheme) => REGISTRY.challenges[s.by] ?? null;

/** What keeping an award needs: the scheme's own note, else the payer's usual duty. */
export const keepFor = (s: Scheme): { text: string; url: string } | null =>
  s.keep ? { text: s.keep, url: s.url } : (REGISTRY.keeps[s.by] ?? null);
type Tri = boolean | null;
export interface SchemeState {
  status: Status;
  reason: string;
  marks: Tri[];
  unknown: FactId[];
}
export type States = Record<string, SchemeState>;

export const known = (A: Answers, f: FactId): boolean =>
  A[f] !== undefined && A[f] !== UNSURE;

const values = (d: Derived): DerivedValues => d as DerivedValues;

function test(cond: Cond, d: Derived, A: Answers): Tri {
  if (cond.gate) return known(A, "benefits") ? Boolean(d.gateway) : null;
  // An "any" over different facts can be settled by whichever part is known.
  if ("any" in cond.test && cond.needs.length > 1) {
    if (run(cond.test, values(d), LINES)) return true;
    return cond.needs.every((f) => known(A, f)) ? false : null;
  }
  if (!cond.needs.every((f) => known(A, f))) return null;
  return run(cond.test, values(d), LINES);
}

function isNear(cond: Cond, d: Derived): boolean {
  if (!cond.near) return false;
  const v = d[cond.near.f as keyof Derived];
  const line = LINES[cond.near.line]?.value;
  return (
    typeof v === "number" &&
    typeof line === "number" &&
    Math.abs(v - line) <= line * REGISTRY.near
  );
}

export function evaluate(A: Answers, today = new Date()): States {
  const d = derive(A, today);
  const st: States = {};
  // Only the rules of the person's country are checked; the rest stay out of the results.
  const here = (i: string) =>
    (byId[i] as Scheme | undefined)?.country === (d.country ?? "GB");
  const ids = [
    ...GATEWAYS.filter(here),
    ...SCHEMES.map((s) => s.id).filter((i) => !GATEWAYS.includes(i) && here(i)),
  ];
  const have = new Set([
    ...(known(A, "benefits")
      ? (A.benefits as string[]).flatMap((b) => ALREADY[b] ?? [])
      : []),
    ...(known(A, "benefitsUs")
      ? (A.benefitsUs as string[]).flatMap((b) => ALREADY_US[b] ?? [])
      : []),
  ]);
  for (const id of ids) {
    const s = byId[id] as Scheme;
    if (have.has(id)) {
      st[id] = {
        status: "have",
        reason: "Already getting this",
        marks: s.rule.map(() => null),
        unknown: [],
      };
      continue;
    }
    const notCovered = d.nation ? s.notCovered[d.nation] : undefined;
    if (notCovered) {
      st[id] = {
        status: "out",
        reason: notCovered,
        marks: s.rule.map(() => null),
        unknown: [],
      };
      continue;
    }
    let fail: string | null = null;
    let gateNo = false;
    let near = false;
    let nearMiss = false;
    const unknown: FactId[] = [];
    const marks: Tri[] = [];
    for (const cond of s.rule) {
      const r = test(cond, d, A);
      marks.push(r);
      // A miss by a small margin only softens its own condition; any clear miss still rules it out.
      const close = r !== null && isNear(cond, d);
      if (close) near = true;
      if (r === false && cond.gate) gateNo = true;
      else if (r === false && !close && !fail) fail = cond.fail;
      else if (r === false && close) nearMiss = true;
      if (r === null)
        unknown.push(...(cond.needs as FactId[]).filter((f) => !known(A, f)));
    }
    let status: Status;
    let reason = "";
    const unk = [...new Set(unknown)];
    if (fail) {
      status = "out";
      reason = fail;
    } else if (gateNo) {
      const alive = GATEWAYS.filter((g) => st[g] && st[g].status !== "out");
      if (alive.length) {
        status = unk.length ? "open" : "unlock";
        reason = `Opens once ${alive.map((g) => byId[g]?.name).join(" or ")} is awarded`;
      } else {
        status = "out";
        reason = "Needs Universal Credit or Pension Credit";
      }
    } else if (nearMiss && !unk.length) {
      status = "check";
      reason = "Close to the line, worth a proper check";
    } else if (!unk.length) {
      status = near || s.worthChecking ? "check" : "likely";
      if (near) reason = "Close to the line, worth a proper check";
      else if (s.worthChecking) reason = s.worthChecking;
    } else if (unk.every((f) => A[f] === UNSURE)) {
      status = "check";
      reason = `Depends on: ${unk.map((f) => FACTS[f].label.toLowerCase()).join(", ")}`;
    } else status = "open";
    st[id] = { status, reason, marks, unknown: unk };
  }
  return st;
}

/** The next question: the one that can settle the most schemes still open. */
export function plan(
  A: Answers,
  st: States,
  focus: FactId[] = [],
): { f: FactId; hits: Scheme[] } | null {
  // A life event the person started from asks its own questions first, while they still matter.
  for (const f of focus) {
    if (A[f] !== undefined) continue;
    const hits = SCHEMES.filter(
      (s) => st[s.id]?.status === "open" && st[s.id]?.unknown.includes(f),
    );
    if (hits.length) return { f, hits };
  }
  let best: { f: FactId; hits: Scheme[] } | null = null;
  for (const f of ORDER) {
    if (A[f] !== undefined) continue;
    const hits = SCHEMES.filter(
      (s) => st[s.id]?.status === "open" && st[s.id]?.unknown.includes(f),
    );
    if (hits.length && (!best || hits.length > best.hits.length))
      best = { f, hits };
  }
  return best;
}

export const count = (st: States, k: Status): number =>
  SCHEMES.filter((s) => st[s.id]?.status === k).length;

/** The schemes checked for these states (the person's country), in registry order. */
export const inPlay = (st: States): Scheme[] => SCHEMES.filter((s) => st[s.id]);
/** Schemes of one country. */
export const schemesOf = (country: string): Scheme[] =>
  SCHEMES.filter((s) => s.country === country);
/** The life areas one country's schemes cover. */
export const topicsOf = (country: string) =>
  TOPICS.filter(([t]) =>
    SCHEMES.some((s) => s.country === country && s.topic === t),
  );

// ---------- Claim order and warnings ----------
export interface PlanStep {
  id: string;
  when: string;
  status: Status;
}

/** Gateways first so the help they unlock follows, then the rest, then what unlocks later. */
export function claimOrder(st: States, nation?: Nation | null): PlanStep[] {
  const yes = (id: string) =>
    st[id]?.status === "likely" || st[id]?.status === "check";
  const steps: (PlanStep & { rank: number })[] = [];
  for (const g of GATEWAYS)
    if (yes(g))
      steps.push({
        id: g,
        when: "Start now",
        status: st[g]?.status ?? "likely",
        rank: 0,
      });
  for (const s of SCHEMES) {
    if (GATEWAYS.includes(s.id) || !yes(s.id)) continue;
    const status = st[s.id]?.status ?? "likely";
    // Start now, then this week (likely before worth checking), then what arrives by itself.
    const rank = isAuto(s, nation)
      ? 4
      : s.urgent
        ? 1
        : status === "likely"
          ? 2
          : 3;
    steps.push({
      id: s.id,
      when: rank === 1 ? "Start now" : "This week",
      status,
      rank,
    });
  }
  for (const s of SCHEMES)
    if (st[s.id]?.status === "unlock")
      steps.push({
        id: s.id,
        when: "After the first award",
        status: "unlock",
        rank: 5,
      });
  return steps.sort((a, b) => a.rank - b.rank).map(({ rank: _r, ...p }) => p);
}

export interface Warning {
  tone: "warn" | "boost";
  text: string;
  ids: string[];
}

export function warnings(st: States, A: Answers = {}): Warning[] {
  const on = (id: string) =>
    ["likely", "check", "unlock", "have"].includes(st[id]?.status ?? "");
  const d = values(derive(A));
  return REGISTRY.clashes
    .filter((w) => w.ids.every(on) && (!w.when || run(w.when, d, LINES)))
    .map((w) => ({ tone: w.tone, text: w.text, ids: w.ids }));
}

/** One short, honest progress line after an answer. Early on nothing is settled, so it says how much is still in play rather than "0 likely". */
export function progressLine(st: States): string {
  const likely = count(st, "likely");
  const check = count(st, "check");
  const open = count(st, "open");
  if (likely)
    return `${likely} ${likely === 1 ? "looks" : "look"} likely so far`;
  if (check) return `${check} worth checking so far`;
  return open ? "Results appear as you answer" : "Nothing matches yet";
}

/** Compact summary used by the agent tools and the plan writer. Holds no personal values. */
export function summarise(A: Answers, st: States) {
  const pick = (k: Status) =>
    SCHEMES.filter((s) => st[s.id]?.status === k).map((s) => ({
      id: s.id,
      name: s.name,
      reason: st[s.id]?.reason || undefined,
    }));
  return {
    likely: pick("likely"),
    worthChecking: pick("check"),
    unlocksLater: pick("unlock"),
    stillOpen: pick("open").map((s) => s.name),
    ruledOut: pick("out").length,
    nextQuestion: plan(A, st)?.f ?? null,
    claimOrder: claimOrder(st, derive(A).nation).map(
      (p) => `${byId[p.id]?.name} (${p.when})`,
    ),
    warnings: warnings(st, A).map((w) => w.text),
  };
}
