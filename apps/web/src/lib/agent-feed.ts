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

export interface FeedGroup {
  /** The answer that set this off, e.g. "Year of birth" */
  title: string;
  items: FeedItem[];
  /** One sentence for screen readers and the phone strip */
  summary: string;
  /** Only the "nothing ruled out" line: dropped when the same question already showed activity */
  filler: boolean;
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
  /** Steps answered or declined so far, in path order */
  answered: Partial<Record<StepId, "done" | "declined">>;
  situation: Situation;
  /** How long the agents took on this answer, measured */
  ms: number;
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
  answered: Partial<Record<StepId, "done" | "declined">>,
  today: Date = new Date(),
): Snapshot {
  const started = performance.now();
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
  for (const p of planSteps(s, today)) {
    if (p.step.id === "review") continue;
    if (!p.shown && p.skipReason) skipped[p.step.id] = p.skipReason;
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
    answered,
    situation: s,
    ms: performance.now() - started,
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

const name = (id: SchemeId): string => schemeById(id).name;
const stillIn = (n: Snapshot, ids: SchemeId[]): SchemeId[] =>
  ids.filter((id) => n.status[id] === "open");

/** Answers that keep support in play, said out loud so a "no change" answer still shows progress. */
function keptLines(step: StepId, n: Snapshot): FeedItem[] {
  const s = n.situation;
  const out: FeedItem[] = [];
  const say = (ids: SchemeId[], text: (names: string) => string) => {
    const open = stillIn(n, ids);
    if (open.length)
      out.push({
        agent: "rules",
        scheme: open[0],
        source: pageOf(open[0] as SchemeId),
        tone: "good",
        text: text(list(open.map(name))),
      });
  };
  if (step === "money" && s.pensionIncome === "under-line")
    say(
      ["pension-credit"],
      (x) => `Income is under the Pension Credit level, so ${x} stays in.`,
    );
  if (step === "money" && (s.earnings === "none" || s.earnings === "up-to-408"))
    say(["healthy-start"], (x) => `Take-home pay is within the ${x} limit.`);
  if (
    step === "savings" &&
    s.savings &&
    s.savings !== "16000-plus" &&
    s.savings !== "rather-not-say"
  )
    say(
      ["universal-credit", "housing-benefit"],
      (x) => `Savings are within the limit for ${x}.`,
    );
  if (
    step === "home" &&
    (s.home === "private-rent" || s.home === "council-or-housing-association")
  )
    say(["housing-benefit"], (x) => `You rent, so ${x} stays in.`);
  if (step === "applies" && s.applies?.includes("health-condition"))
    say(
      ["attendance-allowance"],
      (x) =>
        `A health condition or disability makes daily life harder, so ${x} stays in.`,
    );
  if (step === "applies" && s.applies?.includes("cares-35-hours"))
    say(["carers-allowance"], (x) => `Caring 35 hours or more keeps ${x} in.`);
  return out;
}

/** What changed between two snapshots, told as one group of agent activity. The first snapshot tells nothing. */
export function diff(
  prev: Snapshot | null,
  next: Snapshot,
  /** The question on screen, which names activity from choices not yet saved with Continue */
  current?: StepId,
): { group: FeedGroup | null; moves: Move[] } {
  if (!prev) return { group: null, moves: [] };
  const items: FeedItem[] = [];
  const newly = (Object.keys(next.answered) as StepId[]).filter(
    (k) => next.answered[k] !== prev.answered[k],
  );
  const step = newly.at(-1);
  const titleStep = step ?? current;

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
          : `Noted ${NATION_NAME[next.nation] ?? next.nation}. Beacon checks the rules for England, so support run differently there is set aside.`,
      tone: "neutral",
    });
  if (ageChanged && next.birthYear !== undefined && next.spa !== prev.spa)
    items.push({
      agent: "age",
      text:
        next.spa === "yes"
          ? "Reached State Pension age, so help for people over it can apply."
          : next.spa === "no"
            ? "Under State Pension age, so help for working-age people can apply."
            : `Born in ${next.birthYear}: the month decides State Pension age.`,
      source: SPA_SOURCE,
      tone: "neutral",
    });

  const moves: Move[] = [];
  const nowYours: SchemeId[] = [];
  const unlikely: SchemeId[] = [];
  for (const sc of SCHEMES) {
    const was = prev.status[sc.id];
    const now = next.status[sc.id];
    if (was === now) continue;
    const agent: AgentId = now === "already-get" ? "rules" : cause;
    moves.push({ scheme: sc.id, agent, to: now });
    if (now === "already-get") {
      nowYours.push(sc.id);
      items.push({
        agent,
        scheme: sc.id,
        source: pageOf(sc.id),
        tone: "good",
        text: `You already get ${sc.name}, so Beacon won't check it again.`,
      });
    } else if (now === "ruled-out") unlikely.push(sc.id);
    else
      items.push({
        agent,
        scheme: sc.id,
        source: pageOf(sc.id),
        tone: "good",
        text: `${sc.name} is possible again.`,
      });
  }
  // Three or more at once read as one line; fewer keep their reasons.
  if (unlikely.length >= 3)
    items.push({
      agent: cause,
      tone: "set-aside",
      text: `${unlikely.length} now look unlikely: ${list(unlikely.map(name))}. Each card says why.`,
    });
  else
    for (const id of unlikely)
      items.push({
        agent: cause,
        scheme: id,
        source: pageOf(id),
        tone: "set-aside",
        text: `${name(id)} looks unlikely right now. ${next.reason[id]}`,
      });
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
        text: `${name(id)} can open the door to ${list(opens.map(name))}.`,
      });
  }
  if (step && next.answered[step] === "done")
    items.push(...keptLines(step, next));

  const newlySkipped = (Object.keys(next.skipped) as StepId[]).filter(
    (k) => !(k in prev.skipped) && ROW_LABEL[k],
  );
  for (const k of newlySkipped)
    items.push({
      agent: "planner",
      text: `Skipping "${ROW_LABEL[k]}". ${next.skipped[k]}.`,
      tone: "neutral",
    });

  const open = SCHEMES.filter((s) => next.status[s.id] === "open").length;
  const filler = items.length === 0;
  if (!items.length) {
    if (!step) return { group: null, moves };
    items.push({
      agent: "rules",
      tone: "neutral",
      text:
        next.answered[step] === "declined"
          ? `No answer, so nothing is ruled out on it. ${open} still possible.`
          : `Checked: nothing ruled out. ${open} still possible.`,
    });
  }
  const title = titleStep
    ? (ROW_LABEL[titleStep] ?? "Your answer")
    : "Your answer";
  const moved = moves.length
    ? `${moves.length} card${moves.length === 1 ? "" : "s"} moved. `
    : "";
  return {
    group: {
      title,
      items,
      summary: `${title}: ${moved}${open} still possible.`,
      filler,
    },
    moves,
  };
}
