// BenefitsBench: 30 made-up situations with the verdict the official rules give for each scheme.
// Expectations are written from the rules, never from Beacon's output.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type SchemeId,
  type Situation,
  SituationSchema,
  type Verdict,
} from "@beacon/rules";

export interface Expectation {
  verdict: Verdict;
  /** 'precheck' = settled in code before any reading; 'model' = Beam judges it from the page */
  settledBy: "precheck" | "model";
  /** Other verdicts a careful adviser would also accept from these answers */
  alsoAccept?: Verdict[];
  why?: string;
  /** Set when the rules package does not yet settle this the way the official rules do */
  knownRulesGap?: string;
}

export interface BenchCase {
  id: string;
  title: string;
  story: string;
  situation: Situation;
  expected: Record<SchemeId, Expectation>;
}

export interface Bench {
  name: string;
  version: string;
  /** The "today" every case is judged on (age lines move with time) */
  asOf: string;
  rulesAsOf: string;
  note: string;
  schemes: SchemeId[];
  cases: BenchCase[];
}

export const DATA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "benefitsbench.json",
);

export function loadBench(path: string = DATA_PATH): Bench {
  const bench = JSON.parse(readFileSync(path, "utf8")) as Bench;
  for (const c of bench.cases) c.situation = SituationSchema.parse(c.situation);
  return bench;
}

export const benchToday = (bench: Bench): Date =>
  new Date(`${bench.asOf}T12:00:00Z`);

/** Right when the verdict is the expected one or one the case also accepts. */
export const isRight = (e: Expectation, got: Verdict): boolean =>
  got === e.verdict || (e.alsoAccept?.includes(got) ?? false);
