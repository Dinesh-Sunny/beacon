// The rules engine: derived facts, three-valued evaluation over a rule pack (packs/*.json), the
// question planner, the claim order and clash warnings. Plain code decides; models only explain.
// It runs in the browser, so a check costs the server nothing until someone asks a model for help.

import ukBills from "../../packs/uk-bills.json";
import ukCore from "../../packs/uk-core.json";
import ukHealth from "../../packs/uk-health.json";
import { type Answers, FACTS, type FactId, ORDER, UNSURE } from "./facts.ts";
import { type Cond, type DerivedValues, type PackedScheme, RegistrySchema, run, type Topic } from "./pack.ts";

// ---------- Derived facts ----------
const SCOTLAND = ["AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "TD", "ZE"];
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
}

const isSet = <T>(v: T | undefined | typeof UNSURE): v is T =>
  v !== undefined && v !== UNSURE;

export function derive(A: Answers, today = new Date()): Derived {
  const d: Derived = {};
  if (isSet(A.postcode)) d.nation = nationOf(A.postcode);
  if (isSet(A.dob)) {
    const b = new Date(A.dob);
    d.age = ageOn(b, today);
    const s = spaDate(b);
    d.spa = today >= s.date;
    d.spaLabel = s.label;
  }
  if (isSet(A.benefits))
    d.gateway = A.benefits.includes("uc") || A.benefits.includes("pc");
  if (isSet(A.income)) {
    d.incWeek = Math.round(A.income.amt * PER[A.income.per]);
    d.incYear = d.incWeek * 52;
  }
  if (isSet(A.savings)) d.sav = A.savings;
  if (isSet(A.difficulties)) {
    const x = A.difficulties;
    d.health = x.includes("wash") || x.includes("night") ? "care" : x.length ? "daily" : "none";
    d.move = x.includes("move");
  }
  if (isSet(A.work)) {
    d.work = A.work.status;
    d.hours = A.work.hours ?? 0;
    d.lowWork =
      d.work === "none" || d.work === "sick" || (d.work === "employed" && d.hours < 16);
  }
  if (isSet(A.ni)) d.ni = A.ni === "yes";
  if (isSet(A.child))
    d.childAge = A.child === "none" ? NO_CHILD : ageOn(new Date(A.child), today);
  if (isSet(A.pregnant)) d.pregnant = A.pregnant === "yes";
  if (isSet(A.careHours)) d.careHours = A.careHours;
  if (isSet(A.ctax)) d.ctax = A.ctax === "yes";
  if (isSet(A.bereaved)) d.bereaved = A.bereaved;
  return d;
}

/** Plain-English facts worked out from one answer, shown under the input as you type. */
export function derivedChips(f: FactId, d: Derived): string[] {
  const out: string[] = [];
  if (f === "postcode" && d.nation) out.push(`Lives in ${NATION[d.nation]}`);
  if (f === "dob" && d.age !== undefined) {
    out.push(`Age ${d.age}`);
    out.push(`State Pension age ${d.spaLabel}`);
    out.push(d.spa ? "Pension age reached" : "Working age");
  }
  if (f === "income" && d.incWeek !== undefined) out.push(`£${d.incWeek} a week`);
  if (f === "difficulties" && d.health)
    out.push({ none: "No daily help needed", daily: "Daily living help", care: "Personal care help" }[d.health]);
  if (f === "benefits" && d.gateway !== undefined)
    out.push(d.gateway ? "Opens linked help" : "No linked help yet");
  if (f === "work" && d.work) out.push(d.lowWork ? "Under 16 hours or not working" : "16 hours or more");
  if (f === "child" && d.childAge !== undefined)
    out.push(d.childAge === NO_CHILD ? "No children" : `Youngest is ${d.childAge}`);
  if (f === "careHours" && d.careHours !== undefined)
    out.push(d.careHours >= 35 ? "35 hours or more" : "Under 35 hours");
  return out;
}

// ---------- The packs ----------
// Load order is layer order: the core benefits first, then each group of help built on them.
// Adding a group is a new JSON file here; the registry check fails the build on any bad reference.
export const REGISTRY = RegistrySchema.parse([ukCore, ukBills, ukHealth]);
export type Scheme = PackedScheme;
export type { Cond, Topic };
export const LINES = REGISTRY.lines;
export const TOPICS = REGISTRY.topics;
export const SCHEMES: Scheme[] = REGISTRY.schemes;
export const byId: Record<string, Scheme> = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));
export const GATEWAYS = REGISTRY.gateways;

/** Whether a scheme arrives without a claim where this person lives. */
export const isAuto = (s: Scheme, nation?: Nation | null): boolean =>
  Array.isArray(s.auto) ? Boolean(nation && s.auto.includes(nation)) : Boolean(s.auto);

// ---------- Evaluation ----------
export const RANK: Record<"likely" | "check" | "unlock" | "open" | "out", number> = { likely: 0, check: 1, unlock: 2, open: 3, out: 4 };
export type Status = "open" | "likely" | "check" | "unlock" | "out";
type Tri = boolean | null;
export interface SchemeState {
  status: Status;
  reason: string;
  marks: Tri[];
  unknown: FactId[];
}
export type States = Record<string, SchemeState>;

export const known = (A: Answers, f: FactId): boolean => A[f] !== undefined && A[f] !== UNSURE;

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
  return typeof v === "number" && typeof line === "number" && Math.abs(v - line) <= line * REGISTRY.near;
}

export function evaluate(A: Answers, today = new Date()): States {
  const d = derive(A, today);
  const st: States = {};
  const ids = [...GATEWAYS, ...SCHEMES.map((s) => s.id).filter((i) => !GATEWAYS.includes(i))];
  for (const id of ids) {
    const s = byId[id] as Scheme;
    const notCovered = d.nation ? s.notCovered[d.nation] : undefined;
    if (notCovered) {
      st[id] = { status: "out", reason: notCovered, marks: s.rule.map(() => null), unknown: [] };
      continue;
    }
    let fail: string | null = null;
    let gateNo = false;
    let near = false;
    const unknown: FactId[] = [];
    const marks: Tri[] = [];
    for (const cond of s.rule) {
      const r = test(cond, d, A);
      marks.push(r);
      if (r === false && cond.gate) gateNo = true;
      else if (r === false && !fail) fail = cond.fail;
      if (r !== null && isNear(cond, d)) near = true;
      if (r === null) unknown.push(...(cond.needs as FactId[]).filter((f) => !known(A, f)));
    }
    let status: Status;
    let reason = "";
    const unk = [...new Set(unknown)];
    if (fail && near) {
      status = "check";
      reason = "Close to the line, worth a proper check";
    } else if (fail) {
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
export function plan(A: Answers, st: States): { f: FactId; hits: Scheme[] } | null {
  let best: { f: FactId; hits: Scheme[] } | null = null;
  for (const f of ORDER) {
    if (A[f] !== undefined) continue;
    const hits = SCHEMES.filter((s) => st[s.id]?.status === "open" && st[s.id]?.unknown.includes(f));
    if (hits.length && (!best || hits.length > best.hits.length)) best = { f, hits };
  }
  return best;
}

export const count = (st: States, k: Status): number =>
  SCHEMES.filter((s) => st[s.id]?.status === k).length;

// ---------- Claim order and warnings ----------
export interface PlanStep {
  id: string;
  when: string;
  status: Status;
}

/** Gateways first so the help they unlock follows, then the rest, then what unlocks later. */
export function claimOrder(st: States): PlanStep[] {
  const yes = (id: string) => st[id]?.status === "likely" || st[id]?.status === "check";
  const steps: PlanStep[] = [];
  for (const g of GATEWAYS) if (yes(g)) steps.push({ id: g, when: "Start now", status: st[g]?.status ?? "likely" });
  for (const s of SCHEMES)
    if (!GATEWAYS.includes(s.id) && yes(s.id))
      steps.push({ id: s.id, when: s.urgent ? "Start now" : "This week", status: st[s.id]?.status ?? "likely" });
  for (const s of SCHEMES)
    if (st[s.id]?.status === "unlock") steps.push({ id: s.id, when: "After the first award", status: "unlock" });
  return steps;
}

export interface Warning {
  tone: "warn" | "boost";
  text: string;
  ids: string[];
}

export function warnings(st: States, A: Answers = {}): Warning[] {
  const on = (id: string) => ["likely", "check", "unlock"].includes(st[id]?.status ?? "");
  const d = values(derive(A));
  return REGISTRY.clashes
    .filter((w) => w.ids.every(on) && (!w.when || run(w.when, d, LINES)))
    .map((w) => ({ tone: w.tone, text: w.text, ids: w.ids }));
}

/** Compact summary used by the agent tools and the plan writer. Holds no personal values. */
export function summarise(A: Answers, st: States) {
  const pick = (k: Status) =>
    SCHEMES.filter((s) => st[s.id]?.status === k).map((s) => ({ id: s.id, name: s.name, reason: st[s.id]?.reason || undefined }));
  return {
    likely: pick("likely"),
    worthChecking: pick("check"),
    unlocksLater: pick("unlock"),
    stillOpen: pick("open").map((s) => s.name),
    ruledOut: pick("out").length,
    nextQuestion: plan(A, st)?.f ?? null,
    claimOrder: claimOrder(st).map((p) => `${byId[p.id]?.name} (${p.when})`),
    warnings: warnings(st, A).map((w) => w.text),
  };
}
