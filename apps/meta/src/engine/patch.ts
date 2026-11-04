// The one shape models use to hand facts back: flat, every field nullable. Code validates it
// with zod and turns it into typed Answers. Nothing a model writes reaches the rules unchecked.

import { z } from "zod";
import type { Answers } from "./facts.ts";
import { POSTCODE_RE } from "./rules.ts";

const yn = z.enum(["yes", "no"]).nullable().optional();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const FactPatch = z.object({
  postcode: z.string().max(10).nullable().optional(),
  date_of_birth: isoDate,
  age_years: z.number().int().min(0).max(120).nullable().optional(),
  already_gets: z.array(z.enum(["uc", "pc", "pip", "cb"])).nullable().optional(),
  already_gets_none: z.boolean().nullable().optional(),
  income_amount: z.number().min(0).max(10_000_000).nullable().optional(),
  income_period: z.enum(["week", "month", "year"]).nullable().optional(),
  savings: z.number().min(0).max(100_000_000).nullable().optional(),
  difficulties: z.array(z.enum(["wash", "night", "cook", "move"])).nullable().optional(),
  difficulties_none: z.boolean().nullable().optional(),
  work_status: z.enum(["employed", "self", "none", "sick"]).nullable().optional(),
  work_hours: z.number().min(0).max(168).nullable().optional(),
  paid_national_insurance: yn,
  youngest_child_dob: isoDate,
  no_children: z.boolean().nullable().optional(),
  expecting_baby: yn,
  caring_hours: z.number().min(0).max(168).nullable().optional(),
  pays_council_tax: yn,
  bereaved: z.enum(["no", "partner", "funeral"]).nullable().optional(),
});
export type FactPatch = z.infer<typeof FactPatch>;

/** JSON Schema for the same shape, for tool parameters and structured output. */
export const FACT_PATCH_JSON = {
  type: "object",
  additionalProperties: false,
  properties: {
    postcode: { type: ["string", "null"], description: "Full UK postcode, e.g. HA9 0WS. Only if stated." },
    date_of_birth: { type: ["string", "null"], description: "YYYY-MM-DD, only if the full date is known" },
    age_years: { type: ["integer", "null"], description: "Age in years when no date of birth is given" },
    already_gets: { type: ["array", "null"], items: { type: "string", enum: ["uc", "pc", "pip", "cb"] }, description: "uc = Universal Credit, pc = Pension Credit, pip = PIP or Attendance Allowance, cb = Child Benefit" },
    already_gets_none: { type: ["boolean", "null"], description: "true if they say they get none of these" },
    income_amount: { type: ["number", "null"], description: "Household income after tax, in pounds" },
    income_period: { type: ["string", "null"], enum: ["week", "month", "year", null] },
    savings: { type: ["number", "null"], description: "Savings in pounds" },
    difficulties: { type: ["array", "null"], items: { type: "string", enum: ["wash", "night", "cook", "move"] }, description: "wash = washing, dressing or toilet; night = being safe alone; cook = cooking or medicines; move = walking or getting around" },
    difficulties_none: { type: ["boolean", "null"] },
    work_status: { type: ["string", "null"], enum: ["employed", "self", "none", "sick", null] },
    work_hours: { type: ["number", "null"], description: "Hours a week if employed" },
    paid_national_insurance: { type: ["string", "null"], enum: ["yes", "no", null], description: "Paid NI in the last 2 to 3 years" },
    youngest_child_dob: { type: ["string", "null"], description: "YYYY-MM-DD" },
    no_children: { type: ["boolean", "null"] },
    expecting_baby: { type: ["string", "null"], enum: ["yes", "no", null] },
    caring_hours: { type: ["number", "null"], description: "Hours a week caring for someone" },
    pays_council_tax: { type: ["string", "null"], enum: ["yes", "no", null] },
    bereaved: { type: ["string", "null"], enum: ["no", "partner", "funeral", null], description: "partner = husband, wife or civil partner died; funeral = paying for someone else's funeral" },
  },
} as const;

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
  if (p.date_of_birth && !Number.isNaN(Date.parse(p.date_of_birth)) && new Date(p.date_of_birth) < today) a.dob = p.date_of_birth;
  else if (p.age_years != null) a.dob = dobFromAge(p.age_years, today);
  if (p.already_gets?.length) a.benefits = [...new Set(p.already_gets)];
  else if (p.already_gets_none) a.benefits = [];
  if (p.income_amount != null) a.income = { amt: p.income_amount, per: p.income_period ?? "week" };
  if (p.savings != null) a.savings = p.savings;
  if (p.difficulties?.length) a.difficulties = [...new Set(p.difficulties)];
  else if (p.difficulties_none) a.difficulties = [];
  if (p.work_status === "employed") {
    if (p.work_hours) a.work = { status: "employed", hours: p.work_hours };
  } else if (p.work_status) a.work = { status: p.work_status };
  if (p.paid_national_insurance) a.ni = p.paid_national_insurance;
  if (p.youngest_child_dob && !Number.isNaN(Date.parse(p.youngest_child_dob))) a.child = p.youngest_child_dob;
  else if (p.no_children) a.child = "none";
  if (p.expecting_baby) a.pregnant = p.expecting_baby;
  if (p.caring_hours != null) a.careHours = p.caring_hours;
  if (p.pays_council_tax) a.ctax = p.pays_council_tax;
  if (p.bereaved) a.bereaved = p.bereaved;
  return a;
}
