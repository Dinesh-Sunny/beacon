// What the person told us. Bands only: no name, address, NI number, bank details or exact amounts.

import { z } from "zod";

export const NATIONS = [
  "england",
  "scotland",
  "wales",
  "northern-ireland",
] as const;
export const HOUSEHOLD = [
  "alone",
  "partner",
  "partner-children",
  "children",
  "other-adults",
] as const;
export const HOME = [
  "council-or-housing-association",
  "private-rent",
  "mortgage",
  "own-outright",
  "family-or-friends",
  "care-home",
  "no-settled-home",
] as const;
export const WORK = ["no", "employed", "self-employed"] as const;
export const CURRENT_BENEFITS = [
  "pension-credit",
  "universal-credit",
  "housing-benefit",
  "council-tax-reduction",
  "attendance-allowance",
  "pip-or-dla",
  "carers-allowance",
  "esa",
  "child-benefit",
] as const;
/** Over State Pension age: where income sits against the Pension Credit line for the household. */
export const PENSION_INCOME = [
  "under-line",
  "around-line",
  "well-over-line",
] as const;
/** Working age: take-home earnings a month, cut at the rule edges (408 / 884 / 1,083). */
export const EARNINGS = [
  "none",
  "up-to-408",
  "409-884",
  "885-1083",
  "over-1083",
] as const;
// Working age cuts at 6,000; over State Pension age at 10,000. Both stop at 16,000.
export const SAVINGS = [
  "under-6000",
  "6000-15999",
  "under-10000",
  "10000-15999",
  "16000-plus",
] as const;
export const APPLIES = [
  "health-condition",
  "cares-35-hours",
  "cares-under-35-hours",
] as const;

const tri = z.enum(["yes", "no", "unsure"]);
const skipped = z.literal("rather-not-say");

export const SituationSchema = z.object({
  forSomeoneElse: z.boolean().default(false),
  postcodeDistrict: z
    .string()
    .regex(/^[A-Z]{1,2}\d[A-Z\d]?$/)
    .optional(),
  nation: z.enum(NATIONS).optional(),
  // A council name from postcodes.io: letters and simple punctuation only, so it can't carry instructions.
  // Real names run to 5 words ("King's Lynn and West Norfolk"); a Likely still needs a verified quote.
  council: z
    .string()
    .max(60)
    .regex(/^[\p{L} .,'&()-]+$/u)
    .refine((v) => v.trim().split(/\s+/).length <= 6)
    .optional(),
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  /** Only asked when the birth year is withheld or the month cannot settle it */
  statePensionAge: tri.optional(),
  household: z.enum(HOUSEHOLD).optional(),
  partnerBirthYear: z.number().int().optional(),
  partnerStatePensionAge: tri.optional(),
  childUnder4: z.boolean().optional(),
  expecting: z.boolean().optional(),
  benefits: z.array(z.enum(CURRENT_BENEFITS)).optional(),
  home: z.enum(HOME).optional(),
  billsInName: z
    .object({ rentOrCouncilTax: tri, electricity: tri })
    .partial()
    .optional(),
  work: z.enum(WORK).optional(),
  pensionIncome: z.union([z.enum(PENSION_INCOME), skipped]).optional(),
  earnings: z.union([z.enum(EARNINGS), skipped]).optional(),
  savings: z.union([z.enum(SAVINGS), skipped]).optional(),
  applies: z.array(z.enum(APPLIES)).optional(),
  caredForGetsDisabilityBenefit: tri.optional(),
  careNeeded6Months: tri.optional(),
  landlordCloseRelative: tri.optional(),
  anythingElse: z.string().max(1000).optional(),
});

export type Situation = z.infer<typeof SituationSchema>;
export type CurrentBenefit = (typeof CURRENT_BENEFITS)[number];

export const has = (s: Situation, b: CurrentBenefit): boolean =>
  s.benefits?.includes(b) ?? false;
export const livesWithPartner = (s: Situation): boolean =>
  s.household === "partner" || s.household === "partner-children";
export const hasChildren = (s: Situation): boolean =>
  s.household === "children" || s.household === "partner-children";
