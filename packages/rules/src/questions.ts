// The check: 12 steps in the order that settles the most first. A step shows only when its answer
// can still change a result; otherwise the rail says why it was not needed.

import { needsBirthMonth } from "./age.ts";
import { EARNINGS_EDGES, PENSION_CREDIT, weeklyToMonthly } from "./config.ts";
import { deriveFacts, type Facts } from "./facts.ts";
import {
  has,
  hasChildren,
  livesWithPartner,
  type Situation,
} from "./situation.ts";

export type StepId =
  | "area"
  | "birth-year"
  | "birth-month"
  | "spa-fallback"
  | "household"
  | "partner-birth-year"
  | "children"
  | "benefits"
  | "home"
  | "work"
  | "money"
  | "savings"
  | "pregnancy"
  | "applies"
  | "cared-for"
  | "anything-else"
  | "review";

export interface Option {
  value: string;
  label: string;
  hint?: string;
  /** Selecting it clears the others (checkbox questions) */
  exclusive?: boolean;
}

export interface Step {
  id: StepId;
  /** Section shown in the Beacon path and the Your answers rail */
  section:
    | "Where you live"
    | "Your age"
    | "Your home and family"
    | "Help you get now"
    | "Money"
    | "Health and caring"
    | "Anything else"
    | "Check";
  question: (s: Situation, f: Facts) => string;
  hint?: (s: Situation, f: Facts) => string | undefined;
  kind:
    | "postcode"
    | "year"
    | "month"
    | "radio"
    | "checkbox"
    | "text"
    | "review";
  options?: (s: Situation, f: Facts) => Option[];
  whyWeAsk: string;
  private?: boolean;
  /** null = ask it; a string = skip it and show this in the rail */
  skipReason: (s: Situation, f: Facts) => string | null;
}

const they = (s: Situation, me: string, them: string): string =>
  s.forSomeoneElse ? them : me;
const pcLineMonthly = (s: Situation): number =>
  weeklyToMonthly(
    livesWithPartner(s)
      ? PENSION_CREDIT.coupleWeekly
      : PENSION_CREDIT.singleWeekly,
  );

const ASK = null;

export const STEPS: Step[] = [
  {
    id: "area",
    section: "Where you live",
    kind: "postcode",
    question: (s) => they(s, "Where do you live?", "Where do they live?"),
    hint: () => "The first part of the postcode is enough, like HA9",
    whyWeAsk:
      "Rules change between England, Scotland, Wales and Northern Ireland, and each council runs its own council tax help.",
    skipReason: () => ASK,
  },
  {
    id: "birth-year",
    section: "Your age",
    kind: "year",
    question: (s) =>
      they(s, "What year were you born?", "What year were they born?"),
    hint: () => "For example, 1957",
    whyWeAsk:
      "The year tells us your State Pension age and age-based help, like Winter Fuel Payment. We never ask the full date.",
    skipReason: () => ASK,
  },
  {
    id: "birth-month",
    section: "Your age",
    kind: "month",
    question: (s) =>
      they(s, "Which month were you born?", "Which month were they born?"),
    whyWeAsk:
      "For people born in 1960 or 1961, State Pension age depends on the month.",
    skipReason: (s) =>
      s.birthYear !== undefined && needsBirthMonth(s.birthYear)
        ? ASK
        : "Not needed for your age",
  },
  {
    id: "spa-fallback",
    section: "Your age",
    kind: "radio",
    question: (s) =>
      they(
        s,
        "Have you reached State Pension age?",
        "Have they reached State Pension age?",
      ),
    hint: () => "You can check on GOV.UK: gov.uk/state-pension-age",
    options: () => [
      { value: "yes", label: "Yes" },
      { value: "no", label: "Not yet" },
      { value: "unsure", label: "Not sure" },
    ],
    whyWeAsk:
      "Some help is only for people over State Pension age, and some only for people under it.",
    skipReason: (_s, f) =>
      f.overStatePensionAge === "unsure"
        ? ASK
        : "Worked out from the year you gave",
  },
  {
    id: "household",
    section: "Your home and family",
    kind: "radio",
    question: (s) => they(s, "Who lives with you?", "Who lives with them?"),
    options: () => [
      { value: "alone", label: "No one - I live alone" },
      { value: "partner", label: "A partner" },
      { value: "partner-children", label: "A partner and children" },
      { value: "children", label: "Children" },
      { value: "other-adults", label: "Other adults, like family or lodgers" },
    ],
    whyWeAsk:
      "Couples are assessed together, and living alone can mean a council tax discount.",
    skipReason: () => ASK,
  },
  {
    id: "partner-birth-year",
    section: "Your home and family",
    kind: "year",
    question: () => "What year was your partner born?",
    hint: () => "For example, 1959",
    whyWeAsk:
      "If one of you is under State Pension age, different help applies.",
    skipReason: (s) => (livesWithPartner(s) ? ASK : "Not needed - no partner"),
  },
  {
    id: "children",
    section: "Your home and family",
    kind: "checkbox",
    question: () => "Do any of these apply?",
    options: () => [
      { value: "child-under-4", label: "A child under 4" },
      { value: "expecting", label: "Expecting a baby (10 weeks or more)" },
      { value: "none", label: "None of these", exclusive: true },
    ],
    private: true,
    whyWeAsk: "Healthy Start help is for pregnancy and young children.",
    skipReason: (s) => (hasChildren(s) ? ASK : "Not needed - no children"),
  },
  {
    id: "benefits",
    section: "Help you get now",
    kind: "checkbox",
    question: (s) =>
      they(s, "Do you get any of these now?", "Do they get any of these now?"),
    hint: () => "Tick all that apply. This saves you questions later.",
    options: (_s, f): Option[] =>
      (f.overStatePensionAge === "no"
        ? [
            { value: "universal-credit", label: "Universal Credit" },
            { value: "child-benefit", label: "Child Benefit" },
            { value: "pip-or-dla", label: "PIP or DLA" },
            { value: "esa", label: "ESA" },
            { value: "carers-allowance", label: "Carer's Allowance" },
            { value: "housing-benefit", label: "Housing Benefit" },
          ]
        : ([
            { value: "pension-credit", label: "Pension Credit" },
            { value: "attendance-allowance", label: "Attendance Allowance" },
            { value: "housing-benefit", label: "Housing Benefit" },
            { value: "council-tax-reduction", label: "Council Tax Reduction" },
            { value: "carers-allowance", label: "Carer's Allowance" },
            { value: "pip-or-dla", label: "PIP or DLA" },
          ] as Option[])
      ).concat([{ value: "none", label: "None of these", exclusive: true }]),
    whyWeAsk:
      "Some help opens the door to more, so we can skip questions that would not change anything.",
    skipReason: () => ASK,
  },
  {
    id: "home",
    section: "Your home and family",
    kind: "radio",
    question: (s) =>
      they(
        s,
        "Which is closest to your home?",
        "Which is closest to their home?",
      ),
    options: () => [
      {
        value: "council-or-housing-association",
        label: "I rent from the council or a housing association",
      },
      { value: "private-rent", label: "I rent from a private landlord" },
      { value: "mortgage", label: "I own it with a mortgage" },
      { value: "own-outright", label: "I own it outright" },
      { value: "family-or-friends", label: "I live with family or friends" },
      { value: "care-home", label: "I live in a care home" },
      { value: "no-settled-home", label: "I don't have a settled home" },
    ],
    whyWeAsk: "Help with rent and council tax depends on your home.",
    skipReason: () => ASK,
  },
  {
    id: "work",
    section: "Money",
    kind: "radio",
    question: (s) => they(s, "Do you work?", "Do they work?"),
    options: () => [
      { value: "no", label: "No" },
      { value: "employed", label: "Yes, employed" },
      { value: "self-employed", label: "Yes, self-employed" },
    ],
    whyWeAsk:
      "Earnings affect Universal Credit, Carer's Allowance and Healthy Start.",
    skipReason: (s, f) =>
      f.overStatePensionAge === "yes"
        ? "Not needed - you've reached State Pension age"
        : has(s, "pension-credit")
          ? "Not needed - you get Pension Credit"
          : ASK,
  },
  {
    id: "money",
    section: "Money",
    kind: "radio",
    question: (s, f) =>
      f.overStatePensionAge === "no"
        ? they(
            s,
            "How much do you take home from work each month?",
            "How much do they take home from work each month?",
          )
        : they(
            s,
            "How much money comes in each month?",
            "How much money comes in for them each month?",
          ),
    hint: (s, f) =>
      f.overStatePensionAge === "no"
        ? "After tax. Count only earnings, not benefits."
        : `Count your State Pension, any other pensions and earnings${livesWithPartner(s) ? ", for both of you" : ""}.`,
    options: (s, f) =>
      f.overStatePensionAge === "no"
        ? [
            { value: "none", label: "Nothing from work" },
            {
              value: "up-to-408",
              label: `Up to £${EARNINGS_EDGES.healthyStartMonthly}`,
            },
            { value: "409-884", label: "£409 to £884" },
            { value: "885-1083", label: "£885 to £1,083" },
            { value: "over-1083", label: "More than £1,083" },
            { value: "rather-not-say", label: "I'd rather not say" },
          ]
        : [
            {
              value: "under-line",
              label: `Under about £${pcLineMonthly(s).toLocaleString("en-GB")}`,
            },
            {
              value: "around-line",
              label: `Around £${pcLineMonthly(s).toLocaleString("en-GB")}`,
            },
            {
              value: "well-over-line",
              label: `Well over £${pcLineMonthly(s).toLocaleString("en-GB")}`,
            },
            { value: "rather-not-say", label: "I'd rather not say" },
          ],
    whyWeAsk:
      "We only need to know which side of the official line you are on, never the exact amount.",
    skipReason: (s) =>
      has(s, "pension-credit")
        ? "Not needed - you get Pension Credit"
        : has(s, "universal-credit")
          ? "Not needed - you get Universal Credit"
          : ASK,
  },
  {
    id: "savings",
    section: "Money",
    kind: "radio",
    question: (s) =>
      they(s, "How much is in savings?", "How much do they have in savings?"),
    hint: () => "Include bank accounts and ISAs. Not the home you live in.",
    options: (_s, f) =>
      f.overStatePensionAge === "no"
        ? [
            { value: "under-6000", label: "Under £6,000" },
            { value: "6000-15999", label: "£6,000 to £15,999" },
            { value: "16000-plus", label: "£16,000 or more" },
            { value: "rather-not-say", label: "I'd rather not say" },
          ]
        : [
            { value: "under-10000", label: "Under £10,000" },
            { value: "10000-15999", label: "£10,000 to £15,999" },
            { value: "16000-plus", label: "£16,000 or more" },
            { value: "rather-not-say", label: "I'd rather not say" },
          ],
    whyWeAsk: "Some help has a savings limit. A band is enough.",
    skipReason: (s) =>
      has(s, "pension-credit")
        ? "Not needed - you get Pension Credit"
        : has(s, "universal-credit")
          ? "Not needed - you get Universal Credit"
          : ASK,
  },
  {
    id: "pregnancy",
    section: "Your home and family",
    kind: "radio",
    question: () => "Is anyone in your home pregnant?",
    options: () => [
      { value: "yes", label: "Yes, 10 weeks or more" },
      { value: "no", label: "No" },
      { value: "rather-not-say", label: "I'd rather not say" },
    ],
    private: true,
    whyWeAsk: "Healthy Start helps with food and vitamins in pregnancy.",
    skipReason: (s, f) => {
      if (f.overStatePensionAge === "yes")
        return "Not needed - you've reached State Pension age";
      if (hasChildren(s)) return "Asked with your children";
      const lowIncome =
        has(s, "universal-credit") ||
        s.earnings === "none" ||
        s.earnings === "up-to-408";
      return lowIncome ? ASK : "Not needed for your answers";
    },
  },
  {
    id: "applies",
    section: "Health and caring",
    kind: "checkbox",
    question: (s) =>
      they(
        s,
        "Do any of these apply to you?",
        "Do any of these apply to them?",
      ),
    options: (s) => {
      const out: Option[] = [];
      if (!has(s, "attendance-allowance") && !has(s, "pip-or-dla"))
        out.push({
          value: "health-condition",
          label: "A health condition or disability makes daily life harder",
        });
      if (!has(s, "carers-allowance")) {
        out.push({
          value: "cares-35-hours",
          label: "I look after someone for 35 hours a week or more",
        });
        out.push({
          value: "cares-under-35-hours",
          label: "I look after someone for less than that",
        });
      }
      return out.concat([
        { value: "none", label: "None of these", exclusive: true },
      ]);
    },
    private: true,
    whyWeAsk:
      "Help with care and caring has no savings limit. Your answer stays private and is hidden on screen.",
    skipReason: (s) =>
      (has(s, "attendance-allowance") || has(s, "pip-or-dla")) &&
      has(s, "carers-allowance")
        ? "Not needed - taken from the help you get"
        : ASK,
  },
  {
    id: "cared-for",
    section: "Health and caring",
    kind: "radio",
    question: () => "Does the person you look after get any of these?",
    options: () => [
      {
        value: "yes",
        label: "Attendance Allowance, PIP daily living or DLA care",
      },
      { value: "no", label: "None of these" },
      { value: "unsure", label: "Not sure" },
    ],
    whyWeAsk:
      "Carer's Allowance needs the person you care for to get one of these.",
    skipReason: (s) =>
      s.applies?.includes("cares-35-hours")
        ? ASK
        : "Not needed for your answers",
  },
  {
    id: "anything-else",
    section: "Anything else",
    kind: "text",
    question: () => "Anything else we should know?",
    hint: () => "Optional. Tap one or tell us in your own words.",
    options: () => [
      { value: "stairs-or-walking", label: "Stairs or walking" },
      { value: "heating", label: "Heating or energy bills" },
      { value: "washing-dressing", label: "Washing or dressing" },
      { value: "food", label: "Food" },
      { value: "getting-out", label: "Getting out" },
    ],
    whyWeAsk: "Your own words can point to help the questions did not cover.",
    skipReason: () => ASK,
  },
  {
    id: "review",
    section: "Check",
    kind: "review",
    question: () => "Is this all right?",
    whyWeAsk: "You can change any answer before Beacon reads the rules.",
    skipReason: () => ASK,
  },
];

export interface PlannedStep {
  step: Step;
  shown: boolean;
  skipReason: string | null;
}

/** The whole path for the current answers: which steps show, which are skipped and why. */
export function planSteps(
  s: Situation,
  today: Date = new Date(),
): PlannedStep[] {
  const f = deriveFacts(s, today);
  return STEPS.map((step) => {
    const reason = step.skipReason(s, f);
    return { step, shown: reason === null, skipReason: reason };
  });
}

/** The next step to ask after `current`, or null at the end. */
export function nextStep(
  s: Situation,
  current: StepId | null,
  today?: Date,
): Step | null {
  const plan = planSteps(s, today);
  const start =
    current === null ? 0 : plan.findIndex((p) => p.step.id === current) + 1;
  return plan.slice(start).find((p) => p.shown)?.step ?? null;
}
