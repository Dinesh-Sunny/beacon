// Raw facts a person gives, and the input component each fact type resolves to.
// Wording here is the single source for the question card, the chat and the agent tools.

export const UNSURE = "unsure" as const;
export type Unsure = typeof UNSURE;

export type Period = "week" | "month" | "year";
export interface Money {
  amt: number;
  per: Period;
}
export type WorkStatus = "employed" | "self" | "none" | "sick";
export interface Work {
  status: WorkStatus;
  hours?: number;
}
export type YesNo = "yes" | "no";
export type Bereaved = "no" | "partner" | "funeral";

export interface Answers {
  postcode?: string | Unsure;
  dob?: string | Unsure;
  benefits?: string[] | Unsure;
  income?: Money | Unsure;
  savings?: number | Unsure;
  difficulties?: string[] | Unsure;
  work?: Work | Unsure;
  ni?: YesNo | Unsure;
  child?: string | "none" | Unsure;
  pregnant?: YesNo | Unsure;
  careHours?: number | Unsure;
  ctax?: YesNo | Unsure;
  bereaved?: Bereaved | Unsure;
}
export type FactId = keyof Answers;

export type FactType =
  | "postcode"
  | "date"
  | "money"
  | "moneyPeriod"
  | "checklist"
  | "work"
  | "hours"
  | "yesno"
  | "choice"
  | "childDate";

export interface Fact {
  type: FactType;
  q: string;
  why: string;
  label: string;
  opts?: [string, string][];
  none?: string;
}

export const FACTS: Record<FactId, Fact> = {
  postcode: {
    type: "postcode",
    q: "What's the postcode?",
    why: "Your nation and council decide many schemes.",
    label: "Postcode",
  },
  dob: {
    type: "date",
    q: "What's the date of birth?",
    why: "Age and State Pension age split help into working age and pension age.",
    label: "Date of birth",
  },
  benefits: {
    type: "checklist",
    q: "Which of these do you already get?",
    why: "Some help opens the door to more help.",
    label: "Already gets",
    opts: [
      ["uc", "Universal Credit"],
      ["pc", "Pension Credit"],
      ["pip", "PIP or Attendance Allowance"],
      ["cb", "Child Benefit"],
    ],
    none: "None of these",
  },
  income: {
    type: "moneyPeriod",
    q: "How much money comes into the home?",
    why: "Include wages, pensions and benefits, after tax.",
    label: "Income",
  },
  savings: {
    type: "money",
    q: "How much is in savings?",
    why: "Some help has a savings limit, often £16,000.",
    label: "Savings",
  },
  difficulties: {
    type: "checklist",
    q: "Because of a health condition, what feels hard day to day?",
    why: "This opens disability payments and help getting around.",
    label: "Day-to-day help",
    opts: [
      ["wash", "Washing, dressing or using the toilet"],
      ["night", "Being safe on your own, day or night"],
      ["cook", "Cooking or managing medicines"],
      ["move", "Walking or getting around"],
    ],
    none: "None of these",
  },
  work: {
    type: "work",
    q: "What's the work situation?",
    why: "Decides help with jobs, sickness, caring and childcare.",
    label: "Work",
  },
  ni: {
    type: "yesno",
    q: "Paid National Insurance in the last 2 to 3 years?",
    why: "New Style JSA and ESA depend on contributions, not income.",
    label: "Paid National Insurance",
  },
  child: {
    type: "childDate",
    q: "When was the youngest child born?",
    why: "Family help depends on your child's age.",
    label: "Youngest child",
  },
  pregnant: {
    type: "yesno",
    q: "Is anyone at home expecting a baby?",
    why: "Opens maternity and early-years help.",
    label: "Expecting a baby",
  },
  careHours: {
    type: "hours",
    q: "How many hours a week do you care for someone?",
    why: "Carer payments start at 35 hours a week.",
    label: "Caring hours",
  },
  ctax: {
    type: "yesno",
    q: "Do you pay council tax?",
    why: "Your council can reduce it.",
    label: "Pays council tax",
  },
  bereaved: {
    type: "choice",
    q: "Has someone close to you died recently?",
    why: "Opens bereavement and funeral help.",
    label: "Bereavement",
    opts: [
      ["no", "No"],
      ["partner", "My husband, wife or civil partner"],
      ["funeral", "Someone else, and I'm paying for the funeral"],
    ],
  },
};

export const ORDER = Object.keys(FACTS) as FactId[];

export const REGISTRY: Record<FactType, { comp: string; why: string }> = {
  postcode: { comp: "Postcode", why: "one field gives nation and council" },
  date: { comp: "Date", why: "exact date, age worked out for you" },
  money: { comp: "Money", why: "exact amount, checked against limits" },
  moneyPeriod: { comp: "Money + period", why: "week, month or year, all made weekly" },
  checklist: { comp: "Checklist", why: "several can be true at once" },
  work: { comp: "Status + hours", why: "hours only if employed" },
  hours: { comp: "Hours", why: "compared with the 35-hour line" },
  yesno: { comp: "Yes / No", why: "a single true or false" },
  choice: { comp: "Choice", why: "exactly one of a few options" },
  childDate: { comp: "Date or none", why: "a date, or nothing to ask" },
};

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

export const gbp = (n: number): string =>
  `£${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

const WORK_TXT: Record<WorkStatus, string> = {
  employed: "Employed",
  self: "Self-employed",
  none: "Not working",
  sick: "Off sick",
};

/** How an answer reads back to the person. */
export function formatAnswer(f: FactId, v: unknown): string {
  if (v === UNSURE) return "Not sure";
  const fact = FACTS[f];
  switch (fact.type) {
    case "postcode":
      return String(v).toUpperCase();
    case "date":
      return new Date(String(v)).toLocaleDateString("en-GB", DATE_FMT);
    case "childDate":
      return v === "none"
        ? "No children"
        : new Date(String(v)).toLocaleDateString("en-GB", DATE_FMT);
    case "money":
      return gbp(Number(v));
    case "moneyPeriod": {
      const m = v as Money;
      return `${gbp(m.amt)} a ${m.per}`;
    }
    case "checklist": {
      const list = v as string[];
      if (!list.length) return fact.none ?? "None";
      return list
        .map((k) => fact.opts?.find((o) => o[0] === k)?.[1] ?? k)
        .join(", ");
    }
    case "work": {
      const w = v as Work;
      return w.status === "employed"
        ? `Employed, ${w.hours ?? 0} hours a week`
        : WORK_TXT[w.status];
    }
    case "hours":
      return `${v} hours a week`;
    case "yesno":
      return v === "yes" ? "Yes" : "No";
    case "choice":
      return fact.opts?.find((o) => o[0] === v)?.[1] ?? String(v);
  }
}
