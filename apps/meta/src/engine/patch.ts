// The one shape models use to hand facts back: flat, every field nullable. Code validates it
// with zod and turns it into typed Answers. Nothing a model writes reaches the rules unchecked.

import { z } from "zod";
import {
  type Answers,
  Benefit,
  BenefitUs,
  Bereaved,
  Difficulty,
  Household,
  Housing,
  IsoDate,
  Period,
  WorkStatus,
  YesNo,
} from "./answers-schema.ts";
import { monthOnly } from "./facts.ts";
import { POSTCODE_RE } from "./rules.ts";

const opt = <T extends z.ZodType>(t: T, description?: string) => {
  const o = t.nullable().optional();
  return description ? o.describe(description) : o;
};

export const FactPatch = z.strictObject({
  postcode: opt(
    z.string().max(10),
    "Full UK postcode, e.g. HA9 0WS. Only if stated.",
  ),
  date_of_birth: opt(IsoDate, "YYYY-MM-DD; only the year and month are kept"),
  age_years: opt(
    z.int().min(0).max(120),
    "Age in years when no date of birth is given",
  ),
  already_gets: opt(
    z.array(Benefit),
    "uc = Universal Credit, pc = Pension Credit, pip = PIP or Attendance Allowance, cb = Child Benefit",
  ),
  already_gets_none: opt(
    z.boolean(),
    "true if they say they get none of these",
  ),
  income_amount: opt(
    z.number().min(0).max(10_000_000),
    "Household income after tax, in pounds (dollars in the US)",
  ),
  income_period: opt(Period),
  savings: opt(
    z.number().min(0).max(100_000_000),
    "Savings in pounds (dollars in the US)",
  ),
  difficulties: opt(
    z.array(Difficulty),
    "wash = washing, dressing or toilet; night = being safe alone; cook = cooking or medicines; move = walking or getting around",
  ),
  difficulties_none: opt(z.boolean()),
  work_status: opt(WorkStatus),
  work_hours: opt(z.number().min(0).max(168), "Hours a week if employed"),
  paid_national_insurance: opt(YesNo, "Paid NI in the last 2 to 3 years"),
  youngest_child_dob: opt(IsoDate, "YYYY-MM-DD"),
  no_children: opt(z.boolean()),
  expecting_baby: opt(YesNo),
  caring_hours: opt(
    z.number().min(0).max(168),
    "Hours a week caring for someone",
  ),
  pays_council_tax: opt(YesNo),
  housing: opt(
    Housing,
    "social = rents from council or housing association; private = rents privately; own = owns their home; family = lives with family or friends",
  ),
  lives_with: opt(
    Household,
    "alone = lives alone; children = only with children under 18; partner = with a partner; adults = with other adults",
  ),
  behind_on_bills: opt(
    YesNo,
    "yes if behind on bills, rent, council tax or other payments",
  ),
  bereaved: opt(
    Bereaved,
    "partner = husband, wife or civil partner died; funeral = paying for someone else's funeral",
  ),
  // United States only.
  zip_code: opt(z.string().max(10), "US ZIP code, 5 digits. Only if stated."),
  household_size: opt(
    z.int().min(1).max(20),
    "US: people living in the home, including them",
  ),
  already_gets_us: opt(
    z.array(BenefitUs),
    "US programs they already get: snap = SNAP or food stamps, medicaid, ssi, tanf = cash assistance, wic, ssdi = Social Security Disability",
  ),
  veteran: opt(YesNo, "US: served in the US military"),
});
export type FactPatch = z.infer<typeof FactPatch>;

/** JSON Schema for the same shape, for tool parameters and structured output. Generated, never hand-kept. */
const { $schema: _drop, ...factPatchJson } = z.toJSONSchema(FactPatch, {
  io: "input",
});
export const FACT_PATCH_JSON = factPatchJson;

/** Approximate date of birth from an age: the middle of the possible range. */
function dobFromAge(age: number, today: Date): string {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

export function toAnswers(p: FactPatch, today = new Date()): Answers {
  const a: Answers = {};
  if (p.postcode) {
    const pc = p.postcode.trim().toUpperCase().replace(/\s+/g, " ");
    if (POSTCODE_RE.test(pc)) a.postcode = pc;
  }
  if (
    p.date_of_birth &&
    !Number.isNaN(Date.parse(p.date_of_birth)) &&
    new Date(p.date_of_birth) < today
  )
    a.dob = monthOnly(p.date_of_birth);
  else if (p.age_years != null) {
    a.dob = dobFromAge(p.age_years, today);
    a.dobApprox = true;
  }
  if (p.already_gets?.length) a.benefits = [...new Set(p.already_gets)];
  else if (p.already_gets_none) a.benefits = [];
  if (p.income_amount != null)
    a.income = { amt: p.income_amount, per: p.income_period ?? "week" };
  if (p.savings != null) a.savings = p.savings;
  if (p.difficulties?.length) a.difficulties = [...new Set(p.difficulties)];
  else if (p.difficulties_none) a.difficulties = [];
  if (p.work_status === "employed") {
    if (p.work_hours) a.work = { status: "employed", hours: p.work_hours };
  } else if (p.work_status) a.work = { status: p.work_status };
  if (p.paid_national_insurance) a.ni = p.paid_national_insurance;
  if (p.youngest_child_dob && !Number.isNaN(Date.parse(p.youngest_child_dob)))
    a.child = monthOnly(p.youngest_child_dob);
  else if (p.no_children) a.child = "none";
  if (p.expecting_baby) a.pregnant = p.expecting_baby;
  if (p.caring_hours != null) a.careHours = p.caring_hours;
  if (p.pays_council_tax) a.ctax = p.pays_council_tax;
  if (p.housing) a.housing = p.housing;
  if (p.lives_with) a.household = p.lives_with;
  if (p.behind_on_bills) a.debt = p.behind_on_bills;
  if (p.bereaved) a.bereaved = p.bereaved;
  const zip = p.zip_code?.trim().slice(0, 5);
  if (zip && /^\d{5}$/.test(zip)) a.zip = zip;
  if (p.household_size != null) a.people = p.household_size;
  if (p.already_gets_us?.length) a.benefitsUs = [...new Set(p.already_gets_us)];
  if (p.veteran) a.veteran = p.veteran;
  return a;
}
