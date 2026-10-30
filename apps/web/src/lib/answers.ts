// Answers live only in the browser: React state, mirrored into the URL fragment (#a=...) so a refresh
// or a private link keeps them. Fragments never reach the server.

import {
  deriveFacts,
  type Finding,
  type Option,
  type Situation,
  SituationSchema,
  STEPS,
  type StepId,
} from "@beacon/rules";
import { z } from "zod";
import type { Progress } from "./check-path";

export interface Draft {
  situation: Situation;
  progress: Progress;
  /** "Brent, London" - shown back to the person, never sent */
  areaLabel?: string;
  elseChips: string[];
  elseText: string;
  /** The sample person from "Try an example", so the UI never presents it as the person's own answers */
  example?: boolean;
}

export const emptyDraft = (): Draft => ({
  situation: { forSomeoneElse: false },
  progress: {},
  elseChips: [],
  elseText: "",
});

const DraftSchema = z.object({
  situation: SituationSchema,
  progress: z.record(z.string(), z.enum(["done", "declined"])),
  areaLabel: z.string().max(120).optional(),
  elseChips: z.array(z.string().max(60)).max(10),
  elseText: z.string().max(1000),
  example: z.boolean().optional(),
});

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const encodeFragment = (key: string, value: unknown): string =>
  `${key}=${toBase64Url(JSON.stringify(value))}`;

export function readFragment(hash: string, key: string): unknown {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = params.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(fromBase64Url(raw));
  } catch {
    return undefined;
  }
}

export function parseDraft(value: unknown): Draft | undefined {
  const r = DraftSchema.safeParse(value);
  return r.success ? (r.data as Draft) : undefined;
}

/** Results shared by the private link: findings only, never the answers. */
export interface SavedResults {
  findings: Finding[];
  model?: string;
}

export function parseResults(value: unknown): SavedResults | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as SavedResults).findings)
  )
    return undefined;
  return value as SavedResults;
}

/** The text sent as "anything else": chips and the person's own words. */
export const anythingElse = (d: Draft): string | undefined => {
  const text = [...d.elseChips, d.elseText.trim()].filter(Boolean).join(". ");
  return text ? text.slice(0, 1000) : undefined;
};

export const situationForCheck = (d: Draft): Situation => ({
  ...d.situation,
  anythingElse: anythingElse(d),
});

const stepById = (id: StepId) => {
  const s = STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown step ${id}`);
  return s;
};

export const optionsFor = (
  id: StepId,
  s: Situation,
  today?: Date,
): Option[] => {
  const step = stepById(id);
  return step.options ? step.options(s, deriveFacts(s, today)) : [];
};

const labelOf = (id: StepId, s: Situation, value: string): string =>
  optionsFor(id, s).find((o) => o.value === value)?.label ?? value;

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  }),
);
export const monthName = (m: number): string => MONTHS[m - 1] ?? String(m);
export const MONTH_NAMES = MONTHS;

const PRIVATE_LABEL = "Answered (private)";
const DECLINED = "I'd rather not say";

/** What the rail and the review page show for one step. */
export function valueLabel(id: StepId, d: Draft): string {
  const s = d.situation;
  if (d.progress[id] === "declined") return DECLINED;
  switch (id) {
    case "area":
      return d.areaLabel ?? s.postcodeDistrict ?? "Not sure of the postcode";
    case "birth-year":
      return s.birthYear ? String(s.birthYear) : "";
    case "birth-month":
      return s.birthMonth ? monthName(s.birthMonth) : "";
    case "spa-fallback":
      return s.statePensionAge ? labelOf(id, s, s.statePensionAge) : "";
    case "household":
      return s.household ? labelOf(id, s, s.household) : "";
    case "partner-birth-year":
      return s.partnerBirthYear ? String(s.partnerBirthYear) : "";
    case "children":
    case "pregnancy":
    case "applies":
      return PRIVATE_LABEL;
    case "benefits":
      return s.benefits?.length
        ? s.benefits.map((b) => labelOf(id, s, b)).join(", ")
        : "None of these";
    case "home":
      return s.home ? labelOf(id, s, s.home) : "";
    case "work":
      return s.work ? labelOf(id, s, s.work) : "";
    case "money": {
      const v =
        deriveFacts(s).overStatePensionAge === "no"
          ? s.earnings
          : s.pensionIncome;
      return v ? labelOf(id, s, v) : "";
    }
    case "savings":
      return s.savings ? labelOf(id, s, s.savings) : "";
    case "cared-for":
      return s.caredForGetsDisabilityBenefit
        ? labelOf(id, s, s.caredForGetsDisabilityBenefit)
        : "";
    case "anything-else":
      return anythingElse(d)
        ? [...d.elseChips, d.elseText.trim() ? "In your words" : ""]
            .filter(Boolean)
            .join(", ")
        : "Nothing added";
    default:
      return "";
  }
}

/** Short row labels for the review page. */
export const ROW_LABEL: Partial<Record<StepId, string>> = {
  area: "Where you live",
  "birth-year": "Year of birth",
  "birth-month": "Month of birth",
  "spa-fallback": "State Pension age",
  household: "Who lives with you",
  "partner-birth-year": "Partner's year of birth",
  children: "Children",
  benefits: "Benefits now",
  home: "Home",
  work: "Work",
  money: "Money coming in",
  savings: "Savings",
  pregnancy: "Pregnancy",
  applies: "Health and caring",
  "cared-for": "The person you look after",
  "anything-else": "Anything else",
};
