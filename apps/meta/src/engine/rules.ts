// The rules engine: derived facts, 21 schemes as data, three-valued evaluation, the question
// planner, the claim order and clash warnings. Plain code decides; models only explain.

import { type Answers, FACTS, type FactId, ORDER, UNSURE } from "./facts.ts";

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

export interface Derived {
  nation?: Nation | null;
  age?: number;
  spa?: boolean;
  spaLabel?: string;
  gateway?: boolean;
  incWeek?: number;
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
  if (isSet(A.income)) d.incWeek = Math.round(A.income.amt * PER[A.income.per]);
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
    d.childAge = A.child === "none" ? Number.POSITIVE_INFINITY : ageOn(new Date(A.child), today);
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
    out.push(d.childAge === Number.POSITIVE_INFINITY ? "No children" : `Youngest is ${d.childAge}`);
  if (f === "careHours" && d.careHours !== undefined)
    out.push(d.careHours >= 35 ? "35 hours or more" : "Under 35 hours");
  return out;
}

// ---------- Screening lines (one place, each with its source) ----------
// Weekly income lines are screening estimates for a single adult, not the official calculation.
// Results within NEAR of a line come back as "Worth checking" instead of a guess.
export const LINES = {
  ucIncomeWeek: { value: 500, source: "https://www.gov.uk/universal-credit/eligibility" },
  pcIncomeWeek: { value: 238, source: "https://www.gov.uk/pension-credit/what-youll-get" },
  ctrIncomeWeek: { value: 350, source: "https://www.gov.uk/apply-council-tax-reduction" },
  savingsCap: { value: 16000, source: "https://www.gov.uk/universal-credit/eligibility" },
  careHours: { value: 35, source: "https://www.gov.uk/carers-allowance/eligibility" },
  near: 0.1,
};

// ---------- Rules ----------
type Tri = boolean | null;
export interface Cond {
  needs: FactId[];
  txt: string;
  fail?: string;
  expr: string;
  fn?: (d: Derived) => boolean;
  near?: (d: Derived) => boolean;
  any?: Cond[];
  gate?: boolean;
}

const c = (
  needs: FactId[],
  fn: (d: Derived) => boolean,
  expr: string,
  txt: string,
  fail: string,
  near?: (d: Derived) => boolean,
): Cond => ({ needs, fn, expr, txt, fail, near });
const any = (parts: Cond[], txt: string, fail: string): Cond => ({
  any: parts,
  txt,
  fail,
  needs: [...new Set(parts.flatMap((p) => p.needs))],
  expr: parts.map((p) => p.expr).join(" OR "),
});
const gate = (): Cond => ({
  gate: true,
  needs: ["benefits"],
  expr: "gets Universal Credit or Pension Credit",
  txt: "Gets Universal Credit or Pension Credit",
});
const nearLine = (v: number | undefined, line: number) =>
  v !== undefined && Math.abs(v - line) <= line * LINES.near;

const notSco = (fail: string) =>
  c(["postcode"], (d) => d.nation !== "sco", "nation is not Scotland", "Lives outside Scotland", fail);
const onlySco = c(["postcode"], (d) => d.nation === "sco", "nation is Scotland", "Lives in Scotland", "Only in Scotland");
const workingAge = c(["dob"], (d) => (d.age ?? 0) >= 18 && !d.spa, "18 or over, under State Pension age", "Aged 18 to State Pension age", "Not between 18 and State Pension age");
const underSpa = c(["dob"], (d) => (d.age ?? 0) >= 16 && !d.spa, "16 or over, under State Pension age", "Aged 16 to State Pension age", "Over State Pension age");
const atSpa = c(["dob"], (d) => Boolean(d.spa), "reached State Pension age", "Reached State Pension age", "Under State Pension age");
const sav16 = c(["savings"], (d) => (d.sav ?? 0) <= LINES.savingsCap.value, "savings £16,000 or less", "Savings £16,000 or less", "Savings over £16,000", (d) => nearLine(d.sav, LINES.savingsCap.value));
const hasCondition = c(["difficulties"], (d) => d.health !== "none", "a condition affects daily life", "A condition affects daily life", "No condition affecting daily life");
const lowWork = c(["work"], (d) => Boolean(d.lowWork), "not working, off sick or under 16 hours", "Not working, off sick or under 16 hours", "Working 16 hours or more");
const care35 = c(["careHours"], (d) => (d.careHours ?? 0) >= LINES.careHours.value, "caring 35 hours a week or more", "Cares 35 hours a week or more", "Cares under 35 hours a week");
const earnUnder = c(["work"], (d) => d.work === "none" || d.work === "sick" || (d.hours ?? 0) < 16, "not working or under 16 hours", "Earnings likely under the limit", "Earnings likely over the limit");
const incomeUnder = (line: number) =>
  c(["income"], (d) => (d.incWeek ?? 0) < line, `weekly income under £${line}`, "Income under the screening line", "Income likely above the line", (d) => nearLine(d.incWeek, line));

export type Topic = "low" | "work" | "sick" | "fam" | "dis" | "care" | "death";
export const TOPICS: [Topic, string][] = [
  ["low", "Money and bills"],
  ["dis", "Health and disability"],
  ["care", "Caring for someone"],
  ["fam", "Families"],
  ["work", "Looking for work"],
  ["sick", "Unable to work"],
  ["death", "When someone dies"],
];

export interface Scheme {
  id: string;
  name: string;
  topic: Topic;
  by: string;
  gives: string;
  how: string;
  phone?: string;
  url: string;
  timing?: string;
  /** Paid without a claim once the conditions are met. */
  auto?: boolean;
  /** Start today: the claim date matters. */
  urgent?: boolean;
  rule: Cond[];
  opens?: string[];
}

export const SCHEMES: Scheme[] = [
  { id: "pc", name: "Pension Credit", topic: "low", by: "DWP", gives: "A weekly top-up to your income. It opens the door to more help.", how: "Claim by phone or online.", phone: "0800 99 1234", url: "https://www.gov.uk/pension-credit/how-to-claim", timing: "Can be backdated up to 3 months, so claim soon.", rule: [atSpa, incomeUnder(LINES.pcIncomeWeek.value)], opens: ["ctr", "cwp", "tv", "fep"] },
  { id: "uc", name: "Universal Credit", topic: "low", by: "DWP", gives: "A monthly payment for living costs, with extra for rent, children and caring.", how: "Claim online, then book an interview.", url: "https://www.gov.uk/universal-credit/how-to-claim", timing: "Payment starts from the day you claim.", rule: [workingAge, sav16, incomeUnder(LINES.ucIncomeWeek.value)], opens: ["ctr", "cwp", "ssmg", "hs", "fep"] },
  { id: "ctr", name: "Council Tax Reduction", topic: "low", by: "Your council", gives: "Money off your council tax bill.", how: "Apply to your local council.", url: "https://www.gov.uk/apply-council-tax-reduction", rule: [c(["ctax"], (d) => Boolean(d.ctax), "pays council tax", "Pays council tax", "Doesn't pay council tax"), incomeUnder(LINES.ctrIncomeWeek.value), sav16] },
  { id: "cwp", name: "Cold Weather Payment", topic: "low", by: "DWP", gives: "£25 for each very cold week between November and March.", how: "Paid automatically once you get a qualifying benefit.", auto: true, url: "https://www.gov.uk/cold-weather-payment", rule: [notSco("Scotland has the Winter Heating Payment instead"), gate()] },
  { id: "wfp", name: "Winter Fuel Payment", topic: "low", by: "DWP", gives: "A yearly payment towards heating bills.", how: "Usually paid automatically. If it didn't arrive last winter, check with the Winter Fuel Payment Centre.", auto: true, url: "https://www.gov.uk/winter-fuel-payment", rule: [notSco("Scotland has the Pension Age Winter Heating Payment"), atSpa] },
  { id: "tv", name: "Free TV licence", topic: "low", by: "TV Licensing", gives: "A free TV licence.", how: "Apply to TV Licensing once you get Pension Credit.", url: "https://www.gov.uk/free-discount-tv-licence", rule: [c(["dob"], (d) => (d.age ?? 0) >= 75, "aged 75 or over", "Aged 75 or over", "Under 75"), gate()] },
  { id: "pip", name: "Personal Independence Payment", topic: "dis", by: "DWP", gives: "Help with the extra costs of a condition, not based on income.", how: "Start your claim by phone.", phone: "0800 917 2222", url: "https://www.gov.uk/pip/how-to-claim", rule: [notSco("Scotland has Adult Disability Payment instead"), underSpa, hasCondition] },
  { id: "adp", name: "Adult Disability Payment", topic: "dis", by: "Social Security Scotland", gives: "Help with the extra costs of a condition, not based on income.", how: "Apply online or by phone.", phone: "0800 182 2222", url: "https://www.mygov.scot/adult-disability-payment", rule: [onlySco, underSpa, hasCondition] },
  { id: "aa", name: "Attendance Allowance", topic: "dis", by: "DWP", gives: "A weekly payment if you need help with personal care, not based on income.", how: "Ask for the claim form by phone, or print it.", phone: "0800 731 0122", url: "https://www.gov.uk/attendance-allowance/how-to-claim", timing: "The claim can start from the day of the call if the form goes back within 6 weeks, so phone today.", urgent: true, rule: [notSco("Scotland has Pension Age Disability Payment instead"), atSpa, c(["difficulties"], (d) => d.health === "care", "needs personal care or supervision", "Needs help with personal care or supervision", "Doesn't need personal care or supervision")] },
  { id: "bb", name: "Blue Badge", topic: "dis", by: "Your council", gives: "Park closer to where you need to go.", how: "Apply online to your council.", url: "https://www.gov.uk/apply-blue-badge", rule: [c(["difficulties"], (d) => Boolean(d.move) || d.health === "care", "difficulty walking or needs care", "Difficulty getting around", "No difficulty getting around")] },
  { id: "ca", name: "Carer's Allowance", topic: "care", by: "DWP", gives: "A weekly payment for caring 35 hours or more.", how: "Claim online.", url: "https://www.gov.uk/carers-allowance/how-to-claim", timing: "Can be backdated up to 3 months.", rule: [notSco("Scotland has Carer Support Payment instead"), care35, earnUnder] },
  { id: "csp", name: "Carer Support Payment", topic: "care", by: "Social Security Scotland", gives: "A weekly payment for caring 35 hours or more.", how: "Apply online or by phone.", phone: "0800 182 2222", url: "https://www.mygov.scot/carer-support-payment", rule: [onlySco, care35, earnUnder] },
  { id: "cb", name: "Child Benefit", topic: "fam", by: "HMRC", gives: "A regular payment for each child, and National Insurance credits.", how: "Claim online or by post.", url: "https://www.gov.uk/child-benefit/how-to-claim", timing: "Can be backdated up to 3 months.", rule: [c(["child"], (d) => (d.childAge ?? 99) < 20, "youngest child under 16, or under 20 in education", "Has a child of the right age", "No child of the right age")] },
  { id: "tfc", name: "Tax-Free Childcare", topic: "fam", by: "HMRC", gives: "Up to £2 back for every £8 you spend on childcare.", how: "Apply online.", url: "https://www.gov.uk/tax-free-childcare", rule: [c(["child"], (d) => (d.childAge ?? 99) < 12, "youngest child under 12", "Has a child under 12", "No child under 12"), c(["work"], (d) => d.work === "self" || (d.work === "employed" && (d.hours ?? 0) >= 16), "working", "Working", "Needs to be working")] },
  { id: "ma", name: "Maternity Allowance", topic: "fam", by: "DWP", gives: "Weekly pay around the birth if you can't get Statutory Maternity Pay.", how: "Claim with form MA1.", url: "https://www.gov.uk/maternity-allowance/how-to-claim", rule: [c(["pregnant"], (d) => Boolean(d.pregnant), "expecting a baby", "Expecting a baby", "No one is expecting"), c(["work"], (d) => d.work === "employed" || d.work === "self", "employed or self-employed", "Working recently", "Needs recent work")] },
  { id: "ssmg", name: "Sure Start Maternity Grant", topic: "fam", by: "DWP", gives: "A one-off £500 for your first baby.", how: "Claim with form SF100.", url: "https://www.gov.uk/sure-start-maternity-grant/how-to-claim", timing: "Claim from 11 weeks before the due date until the baby is 6 months.", rule: [notSco("Scotland has the Best Start Grant instead"), any([c(["pregnant"], (d) => Boolean(d.pregnant), "expecting", "", ""), c(["child"], (d) => (d.childAge ?? 99) < 1, "youngest under 1", "", "")], "Baby due or under 1", "No baby due or under 1"), gate()] },
  { id: "hs", name: "Healthy Start", topic: "fam", by: "NHS", gives: "A card for milk, fruit, vegetables and vitamins. On Universal Credit, take-home pay needs to be £408 a month or less.", how: "Apply online.", url: "https://www.healthystart.nhs.uk/how-to-apply/", rule: [notSco("Scotland has Best Start Foods instead"), any([c(["pregnant"], (d) => Boolean(d.pregnant), "expecting", "", ""), c(["child"], (d) => (d.childAge ?? 99) < 4, "youngest under 4", "", "")], "Expecting or child under 4", "No pregnancy or child under 4"), gate()] },
  { id: "jsa", name: "New Style Jobseeker's Allowance", topic: "work", by: "DWP", gives: "A fortnightly payment while you look for work, based on your contributions.", how: "Claim online.", url: "https://www.gov.uk/jobseekers-allowance/how-to-claim", rule: [workingAge, c(["work"], (d) => d.work === "none" || (d.work === "employed" && (d.hours ?? 0) < 16), "not working or under 16 hours", "Not working or under 16 hours", "Working 16 hours or more"), c(["ni"], (d) => Boolean(d.ni), "paid National Insurance in the last 2 to 3 years", "Paid National Insurance", "Not enough National Insurance paid")] },
  { id: "esa", name: "New Style ESA", topic: "sick", by: "DWP", gives: "A payment if a condition stops you working, based on your contributions.", how: "Claim online.", url: "https://www.gov.uk/employment-support-allowance/how-to-claim", rule: [underSpa, hasCondition, lowWork, c(["ni"], (d) => Boolean(d.ni), "paid National Insurance in the last 2 to 3 years", "Paid National Insurance", "Not enough National Insurance paid")] },
  { id: "bsp", name: "Bereavement Support Payment", topic: "death", by: "DWP", gives: "A first payment and monthly payments for 18 months.", how: "Claim online, by phone or by post.", phone: "0800 151 2012", url: "https://www.gov.uk/bereavement-support-payment/how-to-claim", timing: "Claim within 3 months of the death to get the full amount.", rule: [c(["bereaved"], (d) => d.bereaved === "partner", "partner has died", "Partner has died", "Partner hasn't died"), underSpa] },
  { id: "fep", name: "Funeral Expenses Payment", topic: "death", by: "DWP", gives: "Help towards funeral costs, for people on certain benefits.", how: "Claim by phone or post. You can claim before the funeral with the invoice.", phone: "0800 151 2012", url: "https://www.gov.uk/funeral-payments/how-to-claim", timing: "Claim within 6 months of the funeral.", rule: [notSco("Scotland has Funeral Support Payment instead"), c(["bereaved"], (d) => d.bereaved === "partner" || d.bereaved === "funeral", "paying for a funeral", "Paying for a funeral", "Not paying for a funeral"), gate()] },
];

export const byId: Record<string, Scheme> = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));
export const GATEWAYS = ["pc", "uc"];

// ---------- Evaluation ----------
export const RANK: Record<"likely" | "check" | "unlock" | "open" | "out", number> = { likely: 0, check: 1, unlock: 2, open: 3, out: 4 };
export type Status = "open" | "likely" | "check" | "unlock" | "out";
export interface SchemeState {
  status: Status;
  reason: string;
  marks: Tri[];
  unknown: FactId[];
}
export type States = Record<string, SchemeState>;

export const known = (A: Answers, f: FactId): boolean =>
  A[f] !== undefined && A[f] !== UNSURE;

function test(cond: Cond, d: Derived, A: Answers): Tri {
  if (cond.any) {
    const r = cond.any.map((p) => test(p, d, A));
    if (r.includes(true)) return true;
    if (r.every((x) => x === false)) return false;
    return null;
  }
  if (cond.gate) return known(A, "benefits") ? Boolean(d.gateway) : null;
  if (!cond.needs.every((f) => known(A, f))) return null;
  return Boolean(cond.fn?.(d));
}

export function evaluate(A: Answers, today = new Date()): States {
  const d = derive(A, today);
  const st: States = {};
  const ids = [...GATEWAYS, ...SCHEMES.map((s) => s.id).filter((i) => !GATEWAYS.includes(i))];
  for (const id of ids) {
    const s = byId[id] as Scheme;
    let fail: string | null = null;
    let gateNo = false;
    let isNear = false;
    const unknown: FactId[] = [];
    const marks: Tri[] = [];
    for (const cond of s.rule) {
      const r = test(cond, d, A);
      marks.push(r);
      if (r === false && cond.gate) gateNo = true;
      else if (r === false && !fail) fail = cond.fail ?? "";
      if (r !== null && cond.near?.(d)) isNear = true;
      if (r === null) unknown.push(...cond.needs.filter((f) => !known(A, f)));
    }
    let status: Status;
    let reason = "";
    const unk = [...new Set(unknown)];
    if (d.nation === "ni") {
      st[id] = { status: "out", reason: "Northern Ireland runs its own version: see nidirect.gov.uk", marks, unknown: [] };
      continue;
    }
    if (fail && isNear) {
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
      status = isNear ? "check" : "likely";
      if (isNear) reason = "Close to the line, worth a proper check";
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

const CLASHES: { ids: string[]; tone: Warning["tone"]; text: string; when?: (d: Derived) => boolean }[] = [
  { ids: ["ca", "uc"], tone: "warn", text: "Carer's Allowance counts as income for Universal Credit, so Universal Credit goes down by the same amount. You can still get the carer element." },
  { ids: ["ca"], tone: "warn", text: "If you get Carer's Allowance, the person you care for may lose a severe disability addition in their own means-tested benefits. Check with them first." },
  { ids: ["aa", "pc"], tone: "boost", text: "Attendance Allowance can raise Pension Credit, so claim both." },
  { ids: ["pc", "ctr"], tone: "boost", text: "Pension Credit usually means a bigger Council Tax Reduction." },
  { ids: ["jsa", "uc"], tone: "warn", text: "New Style JSA counts as income for Universal Credit." },
  { ids: ["esa", "uc"], tone: "warn", text: "New Style ESA counts as income for Universal Credit." },
  { ids: ["ma", "uc"], tone: "warn", text: "Maternity Allowance counts as income for Universal Credit." },
  { ids: ["wfp"], tone: "warn", text: "Income over £35,000 a year means the Winter Fuel Payment is taken back through tax.", when: (d) => (d.incWeek ?? 0) * 52 > 35_000 },
];

export function warnings(st: States, A: Answers = {}): Warning[] {
  const on = (id: string) => ["likely", "check", "unlock"].includes(st[id]?.status ?? "");
  const d = derive(A);
  return CLASHES.filter((w) => w.ids.every(on) && (!w.when || w.when(d))).map((w) => ({ tone: w.tone, text: w.text, ids: w.ids }));
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
