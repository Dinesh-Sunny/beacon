// How the 17 question steps from @beacon/rules fold into the 12-dot Beacon path and the "Your answers"
// rail (beacon-builder kit11a STEPS, D-020..D-032). Follow-ups live inside their parent step.

import {
  deriveFacts,
  type PlannedStep,
  planSteps,
  type Situation,
  type StepId,
} from "@beacon/rules";

export type PathKey =
  | "area"
  | "born"
  | "house"
  | "benefits"
  | "home"
  | "work"
  | "money"
  | "savings"
  | "pregnancy"
  | "apply"
  | "else"
  | "review";

export const PATH: { key: PathKey; label: string; steps: StepId[] }[] = [
  { key: "area", label: "Where you live", steps: ["area"] },
  {
    key: "born",
    label: "Year of birth",
    steps: ["birth-year", "birth-month", "spa-fallback"],
  },
  {
    key: "house",
    label: "Who lives with you",
    steps: ["household", "partner-birth-year", "children"],
  },
  { key: "benefits", label: "Benefits now", steps: ["benefits"] },
  { key: "home", label: "Home", steps: ["home"] },
  { key: "work", label: "Work", steps: ["work"] },
  { key: "money", label: "Money coming in", steps: ["money"] },
  { key: "savings", label: "Savings", steps: ["savings"] },
  { key: "pregnancy", label: "Pregnancy", steps: ["pregnancy"] },
  { key: "apply", label: "Health and caring", steps: ["applies", "cared-for"] },
  { key: "else", label: "Anything else", steps: ["anything-else"] },
  { key: "review", label: "Check your answers", steps: ["review"] },
];

export const pathKeyOf = (id: StepId): PathKey => {
  const p = PATH.find((x) => x.steps.includes(id));
  if (!p) throw new Error(`Step ${id} is not on the path`);
  return p.key;
};

export type StepStatus = "done" | "declined";
export type Progress = Partial<Record<StepId, StepStatus>>;

export interface PathRow {
  key: PathKey;
  label: string;
  shown: boolean;
  /** Reason from questions.ts when the whole step is not needed */
  skipReason: string | null;
  /** First shown sub-step, the one "Change" goes to */
  first: StepId | null;
  status: "done" | "declined" | "todo" | "skipped";
  /** 1-based number among shown steps */
  number: number;
}

export function pathRows(
  s: Situation,
  progress: Progress,
  today?: Date,
): PathRow[] {
  const plan = planSteps(s, today);
  const byId = new Map<StepId, PlannedStep>(plan.map((p) => [p.step.id, p]));
  let n = 0;
  return PATH.map(({ key, label, steps }) => {
    const shownSteps = steps.filter((id) => byId.get(id)?.shown);
    const shown = shownSteps.length > 0;
    if (shown) n += 1;
    const head = byId.get(steps[0] as StepId);
    const statuses = shownSteps.map((id) => progress[id]);
    const status: PathRow["status"] = !shown
      ? "skipped"
      : statuses.every((x) => x)
        ? statuses[0] === "declined"
          ? "declined"
          : "done"
        : "todo";
    return {
      key,
      label,
      shown,
      skipReason: shown ? null : (head?.skipReason ?? null),
      first: shownSteps[0] ?? null,
      status,
      number: shown ? n : 0,
    };
  });
}

/** Steps that are shown now but not answered yet, in order. */
export function gaps(s: Situation, progress: Progress, today?: Date): StepId[] {
  return planSteps(s, today)
    .filter((p) => p.shown && !progress[p.step.id] && p.step.id !== "review")
    .map((p) => p.step.id);
}

export const isOverSpa = (s: Situation, today?: Date): boolean =>
  deriveFacts(s, today).overStatePensionAge !== "no";
