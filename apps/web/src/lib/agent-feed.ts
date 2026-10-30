// The live agent canvas beside the check. Nothing here is theatre: each "agent" is a real step that
// runs in the browser on the answers so far (council look-up, State Pension age, the precheck rules,
// the question planner), and every move it shows comes from comparing two snapshots of that output.

import {
  type PrecheckStatus,
  planSteps,
  precheck,
  reachedStatePensionAge,
  SCHEMES,
  type SchemeId,
  type Situation,
  type StepId,
  schemeById,
  type Tri,
} from "@beacon/rules";
import { ROW_LABEL } from "./answers";

export type AgentId = "area" | "age" | "rules" | "planner";

export const AGENTS: Record<AgentId, { name: string; job: string }> = {
  area: {
    name: "Area agent",
    job: "Finds your council and which nation's rules apply",
  },
  age: {
    name: "Age agent",
    job: "Works out State Pension age from your birth year",
  },
  rules: {
    name: "Rules agent",
    job: "Settles the hard rules before anything is read",
  },
  planner: {
    name: "Planner",
    job: "Skips questions that can't change a result",
  },
};

export interface Source {
  label: string;
  url: string;
}

export interface FeedItem {
  agent: AgentId;
  text: string;
  source?: Source;
  scheme?: SchemeId;
  tone: "good" | "neutral" | "set-aside";
}

export interface Move {
  scheme: SchemeId;
  agent: AgentId;
  to: PrecheckStatus;
}

export interface Snapshot {
  status: Record<SchemeId, PrecheckStatus>;
  reason: Record<SchemeId, string>;
  council?: string;
  nation?: string;
  birthYear?: number;
  birthMonth?: number;
  spa: Tri;
  skipped: Partial<Record<StepId, string>>;
  questionsLeft: number;
}

const POSTCODES: Source = {
  label: "postcodes.io",
  url: "https://postcodes.io",
};
const SPA_SOURCE: Source = {
  label: "GOV.UK: State Pension age",
  url: "https://www.gov.uk/state-pension-age",
};
const pageOf = (id: SchemeId): Source => {
  const s = schemeById(id);
  return {
    label: `GOV.UK: ${s.name}`,
    url: `https://www.gov.uk${s.govukPaths[0] ?? ""}`,
  };
};

/**
 * The most hopeful answers to the questions not asked yet. The canvas only sets support aside when it
 * is ruled out even with these, so an unanswered question never counts as "no".
 */
function hopeful(s: Situation, partnerOver: Tri): Situation {
  const partnerUnknown =
    s.partnerBirthYear === undefined && s.partnerStatePensionAge === undefined;
  return {
    ...s,
    partnerStatePensionAge: partnerUnknown
      ? partnerOver
      : s.partnerStatePensionAge,
    household: s.household ?? "partner-children",
    childUnder4: s.childUnder4 ?? true,
    expecting: s.expecting ?? true,
    home: s.home ?? "private-rent",
    applies: s.applies ?? ["health-condition", "cares-35-hours"],
    pensionIncome: s.pensionIncome ?? "under-line",
    earnings: s.earnings ?? "none",
    caredForGetsDisabilityBenefit: s.caredForGetsDisabilityBenefit ?? "yes",
    careNeeded6Months: s.careNeeded6Months ?? "yes",
    landlordCloseRelative: s.landlordCloseRelative ?? "no",
  };
}

export function snapshot(
  s: Situation,
  answered: Partial<Record<StepId, unknown>>,
  today: Date = new Date(),
): Snapshot {
  const actual = new Map(precheck(s, today).map((p) => [p.scheme, p]));
  const status = {} as Record<SchemeId, PrecheckStatus>;
  const reason = {} as Record<SchemeId, string>;
  // A partner's age can't be hopeful for every scheme at once, so try both and keep what survives.
  const older = precheck(hopeful(s, "yes"), today);
  const younger = new Map(
    precheck(hopeful(s, "no"), today).map((p) => [p.scheme, p]),
  );
  for (const p of older) {
    const got = actual.get(p.scheme);
    const other = younger.get(p.scheme);
    const settled =
      got?.status === "already-get"
        ? got
        : p.status === "ruled-out" && other?.status === "ruled-out"
          ? p
          : { ...p, status: "open" as const };
    status[p.scheme] = settled.status;
    reason[p.scheme] = settled.reason;
  }
  const skipped: Partial<Record<StepId, string>> = {};
  let questionsLeft = 0;
  for (const p of planSteps(s, today)) {
    if (p.step.id === "review") continue;
    if (!p.shown && p.skipReason) skipped[p.step.id] = p.skipReason;
    else if (p.shown && !answered[p.step.id]) questionsLeft += 1;
  }
  return {
    status,
    reason,
    council: s.council,
    nation: s.nation,
    birthYear: s.birthYear,
    birthMonth: s.birthMonth,
    spa:
      s.statePensionAge ??
      (s.birthYear === undefined
        ? "unsure"
        : reachedStatePensionAge(
            s.birthMonth
              ? { year: s.birthYear, month: s.birthMonth }
              : { year: s.birthYear },
            today,
          )),
    skipped,
    questionsLeft,
  };
}

const NATION_NAME: Record<string, string> = {
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
};

const list = (names: string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** What changed between two snapshots, told as agent activity. The first snapshot tells nothing. */
export function diff(
  prev: Snapshot | null,
  next: Snapshot,
): { items: FeedItem[]; moves: Move[] } {
  if (!prev) return { items: [], moves: [] };
  const items: FeedItem[] = [];

  const ageChanged =
    prev.birthYear !== next.birthYear ||
    prev.birthMonth !== next.birthMonth ||
    prev.spa !== next.spa;
  const areaChanged =
    prev.council !== next.council || prev.nation !== next.nation;
  const cause: AgentId = ageChanged ? "age" : areaChanged ? "area" : "rules";

  if (areaChanged && next.council)
    items.push({
      agent: "area",
      text: `Found ${next.council} council. Local help like Council Tax Reduction follows its rules.`,
      source: POSTCODES,
      tone: "neutral",
    });
  if (areaChanged && next.nation && next.nation !== prev.nation)
    items.push({
      agent: "area",
      text:
        next.nation === "england"
          ? "Using the rules for England."
          : `Noted ${NATION_NAME[next.nation] ?? next.nation}. Some support works differently there, and Beacon will say which.`,
      tone: "neutral",
    });
  if (ageChanged && next.birthYear !== undefined && next.spa !== prev.spa)
    items.push({
      agent: "age",
      text:
        next.spa === "yes"
          ? "Reached State Pension age. Pension-age help is in play."
          : next.spa === "no"
            ? "Under State Pension age. Working-age help is in play."
            : `Born in ${next.birthYear}: the month decides State Pension age.`,
      source: SPA_SOURCE,
      tone: "neutral",
    });

  const moves: Move[] = [];
  const nowYours: SchemeId[] = [];
  for (const sc of SCHEMES) {
    const was = prev.status[sc.id];
    const now = next.status[sc.id];
    if (was === now) continue;
    const agent: AgentId = now === "already-get" ? "rules" : cause;
    moves.push({ scheme: sc.id, agent, to: now });
    if (now === "already-get") nowYours.push(sc.id);
    items.push({
      agent,
      scheme: sc.id,
      source: pageOf(sc.id),
      tone:
        now === "ruled-out"
          ? "set-aside"
          : now === "already-get"
            ? "good"
            : "neutral",
      text:
        now === "ruled-out"
          ? `${sc.name} set aside: ${next.reason[sc.id]}`
          : now === "already-get"
            ? `You already get ${sc.name}, so Beacon won't re-check it.`
            : `${sc.name} is back on the reading list.`,
    });
  }
  for (const id of nowYours) {
    const opens = (schemeById(id).unlocks ?? []).filter(
      (u) => next.status[u] === "open",
    );
    if (opens.length)
      items.push({
        agent: "rules",
        scheme: id,
        source: pageOf(id),
        tone: "good",
        text: `${schemeById(id).name} can open the door to ${list(opens.map((u) => schemeById(u).name))}.`,
      });
  }

  const newlySkipped = (Object.keys(next.skipped) as StepId[]).filter(
    (k) => !(k in prev.skipped) && ROW_LABEL[k],
  );
  for (const k of newlySkipped)
    items.push({
      agent: "planner",
      text: `Skipping "${ROW_LABEL[k]}". ${next.skipped[k]}.`,
      tone: "neutral",
    });

  return { items, moves };
}
