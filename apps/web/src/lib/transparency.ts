import type { Bench } from "@beacon/evals";
import raw from "@beacon/evals/data";
import { precheck, SCHEMES, SituationSchema } from "@beacon/rules";

export interface BenchStats {
  name: string;
  version: string;
  asOf: string;
  cases: number;
  judgements: number;
  settledInCode: number;
  leftForBeam: number;
  /** Code-settled expectations the precheck gets right today */
  codeAgrees: number;
}

/** BenefitsBench numbers worked out at build time from the dataset and today's rules. Nothing estimated. */
export function benchStats(): BenchStats {
  // Imported as JSON (not read from disk) so the build traces only this file.
  const bench = raw as unknown as Bench;
  const today = new Date(`${bench.asOf}T12:00:00Z`);
  let judgements = 0;
  let settledInCode = 0;
  let codeAgrees = 0;
  for (const c of bench.cases) {
    const got = new Map(
      precheck(SituationSchema.parse(c.situation), today).map((p) => [
        p.scheme,
        p.status,
      ]),
    );
    for (const s of SCHEMES) {
      const e = c.expected[s.id];
      judgements += 1;
      if (e.settledBy !== "precheck") continue;
      settledInCode += 1;
      const want = e.verdict === "already-get" ? "already-get" : "ruled-out";
      if (got.get(s.id) === want) codeAgrees += 1;
    }
  }
  return {
    name: bench.name,
    version: bench.version,
    asOf: bench.asOf,
    cases: bench.cases.length,
    judgements,
    settledInCode,
    leftForBeam: judgements - settledInCode,
    codeAgrees,
  };
}
