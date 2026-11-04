// Raw facts a person gives, and the input component each fact type resolves to.
// Wording here is the single source for the question card, the chat and the agent tools.

import type { z } from "zod";
import type * as S from "./answers-schema.ts";

export { type Answers, type FactId, UNSURE, type Unsure } from "./answers-schema.ts";
import { type Answers, type FactId, UNSURE } from "./answers-schema.ts";

export type Period = z.infer<typeof S.Period>;
export type Money = z.infer<typeof S.Money>;
export type WorkStatus = z.infer<typeof S.WorkStatus>;
export type Work = z.infer<typeof S.Work>;
export type YesNo = z.infer<typeof S.YesNo>;
export type Bereaved = z.infer<typeof S.Bereaved>;

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
  /** The same question about someone else; {n} is who it's for, for example "Mum". */
  qThey: string;
  why: string;
  label: string;
  opts?: [string, string][];
  none?: string;
}

export const FACTS: Record<FactId, Fact> = {
  postcode: {
    type: "postcode",
    q: "What's your postcode?",
    qThey: "What's {n}'s postcode?",
    why: "Your nation and council decide many schemes.",
    label: "Postcode",
  },
  dob: {
    type: "date",
    q: "What's your date of birth?",
    qThey: "What's {n}'s date of birth?",
    why: "Age and State Pension age split help into working age and pension age.",
    label: "Date of birth",
  },
  benefits: {
    type: "checklist",
    q: "Which of these do you already get?",
    qThey: "Which of these does {n} already get?",
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
    q: "How much money comes into your home?",
    qThey: "How much money comes into {n}'s home?",
    why: "Include wages, pensions and benefits, after tax.",
    label: "Income",
  },
  savings: {
    type: "money",
    q: "How much do you have in savings?",
    qThey: "How much does {n} have in savings?",
    why: "Some help has a savings limit, often £16,000.",
    label: "Savings",
  },
  difficulties: {
    type: "checklist",
    q: "Because of a health condition, what feels hard day to day?",
    qThey: "Because of a health condition, what does {n} find hard day to day?",
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
    q: "What's your work situation?",
    qThey: "What's {n}'s work situation?",
    why: "Decides help with jobs, sickness, caring and childcare.",
    label: "Work",
  },
  ni: {
    type: "yesno",
    q: "Have you paid National Insurance in the last 2 to 3 years?",
    qThey: "Has {n} paid National Insurance in the last 2 to 3 years?",
    why: "New Style JSA and ESA depend on contributions, not income.",
    label: "Paid National Insurance",
  },
  child: {
    type: "childDate",
    q: "When was your youngest child born?",
    qThey: "When was {n}'s youngest child born?",
    why: "Family help depends on your child's age.",
    label: "Youngest child",
  },
  pregnant: {
    type: "yesno",
    q: "Is anyone at home expecting a baby?",
    qThey: "Is anyone in {n}'s home expecting a baby?",
    why: "Opens maternity and early-years help.",
    label: "Expecting a baby",
  },
  careHours: {
    type: "hours",
    q: "How many hours a week do you care for someone?",
    qThey: "How many hours a week does {n} care for someone?",
    why: "Carer payments start at 35 hours a week.",
    label: "Caring hours",
  },
  ctax: {
    type: "yesno",
    q: "Do you pay council tax?",
    qThey: "Does {n} pay council tax?",
    why: "Your council can reduce it.",
    label: "Pays council tax",
  },
  housing: {
    type: "choice",
    q: "Where do you live?",
    qThey: "Where does {n} live?",
    why: "Renting can open help with the rent.",
    label: "Home",
    opts: [
      ["social", "Rent from the council or a housing association"],
      ["private", "Rent privately"],
      ["own", "Own it"],
      ["family", "Live with family or friends"],
    ],
  },
  bereaved: {
    type: "choice",
    q: "Has someone close to you died recently?",
    qThey: "Has someone close to {n} died recently?",
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

/** Who the check is for. A relationship word only (Mum, Dad), never a name we need to keep. */
export interface Subject {
  who: "me" | "other";
  label?: string;
}
export const ME: Subject = { who: "me" };

const RELATION = /^(my |a |mum|dad|mom|nan|gran|grandma|grandad|friend|partner|husband|wife|son|daughter|brother|sister|aunt|uncle)/i;

/** How the caller names the person: "my mum" for a relationship, the name itself for a name like "Fiona". */
export function callerPhrase(sub: Subject): string {
  const label = (sub.label ?? "").replace(/[^\p{L} '-]/gu, "").trim();
  if (sub.who === "me") return "I";
  if (!label) return "my relative";
  return RELATION.test(label) ? `my ${label.toLowerCase().replace(/^(my|a) /, "")}` : label;
}

export function ask(f: FactId, sub: Subject): string {
  const fact = FACTS[f];
  if (sub.who === "me") return fact.q;
  return fact.qThey.replaceAll("{n}", sub.label?.trim() || "the person");
}

/** Turns "you" copy into "they" copy when the check is for someone else. */
export function theyify(text: string, sub: Subject): string {
  if (sub.who === "me") return text;
  return text
    .replace(/\bYour\b/g, "Their")
    .replace(/\byour\b/g, "their")
    .replace(/\byou're\b/g, "they're")
    .replace(/\bYou\b/g, "They")
    // "you" as an object becomes "them": after a verb or preposition, or before punctuation.
    .replace(/\b(add|adds|help|helps|to|for|with|give|gives|tell|ask|let|contact|call|send|pay|pays|protect|protects|stop|stops|reach|support|supports|from|about) you\b/g, "$1 them")
    .replace(/\byou(?=[.,;:!?])/g, "them")
    .replace(/\byou\b/g, "they");
}

/** Option wording that changes with who the check is for. */
export function optLabel(label: string, sub: Subject): string {
  if (sub.who === "me") return label;
  return label.replace(/^My /, "Their ").replace(/I'm paying/, "they're paying");
}

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

/** Reads back an answer using everything known, so an age stays an age. */
export function showAnswer(a: Answers, f: FactId): string {
  if (f === "dob" && a.dobApprox && typeof a.dob === "string" && a.dob !== UNSURE) {
    const b = new Date(a.dob);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
    return `About ${age}`;
  }
  return formatAnswer(f, a[f]);
}

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
