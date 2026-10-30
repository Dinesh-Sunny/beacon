// Runs BenefitsBench against the real agent on Beam at three effort levels and writes:
//   results/<stamp>.jsonl  one line per case and effort (verdicts, tokens, quotes)
//   results/summary.md     accuracy per scheme, tokens per effort, quote-verified rate
// Contract with @beacon/brain: runCheck(situation, { effort, today }) returns the CheckEvent stream
// (an async iterable) or a promise of the events. Imported lazily so tests and type-checks never need
// a token or the agent.
//
// Usage: pnpm eval [--effort low,medium,high] [--cases id,id] [--limit 5]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type CheckEvent,
  type Effort,
  type Finding,
  precheck,
  SCHEMES,
  type SchemeId,
  type Situation,
  type Verdict,
} from "@beacon/rules";
import {
  type Bench,
  type BenchCase,
  benchToday,
  isRight,
  loadBench,
} from "./dataset.ts";

export type RunCheck = (
  s: Situation,
  opts: { effort: Effort; today: Date },
) =>
  | AsyncIterable<CheckEvent>
  | Promise<CheckEvent[] | AsyncIterable<CheckEvent>>;

export interface CaseResult {
  case: string;
  effort: Effort;
  model: string;
  ms: number;
  error?: string;
  verdicts: Partial<Record<SchemeId, Verdict>>;
  right: Partial<Record<SchemeId, boolean>>;
  quotes: { proposed: number; verified: number };
  tokens: {
    input: number;
    output: number;
    byStep: Record<string, { input: number; output: number }>;
  };
}

const EFFORTS: Effort[] = ["low", "medium", "high"];
const BRAIN = "@beacon/brain";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "results");

async function collect(
  out: Awaited<ReturnType<RunCheck>>,
): Promise<CheckEvent[]> {
  if (Array.isArray(out)) return out;
  const events: CheckEvent[] = [];
  for await (const e of out) events.push(e);
  return events;
}

/** Final verdict per scheme: the settled finding if Beam judged it, otherwise what code settled. */
function verdictsFor(
  c: BenchCase,
  findings: Finding[],
  today: Date,
): Partial<Record<SchemeId, Verdict>> {
  const out: Partial<Record<SchemeId, Verdict>> = {};
  for (const p of precheck(c.situation, today)) {
    if (p.status === "already-get") out[p.scheme] = "already-get";
    if (p.status === "ruled-out") out[p.scheme] = "unlikely-right-now";
  }
  for (const f of findings) out[f.scheme] = f.verdict;
  return out;
}

export async function runOne(
  runCheck: RunCheck,
  c: BenchCase,
  effort: Effort,
  today: Date,
): Promise<CaseResult> {
  const started = Date.now();
  const r: CaseResult = {
    case: c.id,
    effort,
    model: "",
    ms: 0,
    verdicts: {},
    right: {},
    quotes: { proposed: 0, verified: 0 },
    tokens: { input: 0, output: 0, byStep: {} },
  };
  const findings: Finding[] = [];
  try {
    for (const e of await collect(
      await runCheck(c.situation, { effort, today }),
    )) {
      if (e.type === "finding") findings.push(e.finding);
      if (e.type === "done") r.model = e.model;
      if (e.type === "error") r.error = e.message;
      if (e.type === "usage") {
        r.tokens.input += e.inputTokens;
        r.tokens.output += e.outputTokens;
        const step = r.tokens.byStep[e.step] ?? { input: 0, output: 0 };
        r.tokens.byStep[e.step] = step;
        step.input += e.inputTokens;
        step.output += e.outputTokens;
      }
    }
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  r.quotes.proposed = findings.length;
  r.quotes.verified = findings.filter((f) => f.quoteVerified).length;
  r.verdicts = verdictsFor(c, findings, today);
  for (const s of SCHEMES) {
    const got = r.verdicts[s.id];
    r.right[s.id] = got !== undefined && isRight(c.expected[s.id], got);
  }
  r.ms = Date.now() - started;
  return r;
}

const pct = (n: number, d: number): string =>
  d === 0 ? "-" : `${Math.round((100 * n) / d)}%`;

export function summarise(
  bench: Bench,
  results: CaseResult[],
  stamp: string,
): string {
  const efforts = EFFORTS.filter((e) => results.some((r) => r.effort === e));
  const byCase = new Map(bench.cases.map((c) => [c.id, c]));
  const lines: string[] = [
    `# BenefitsBench results - ${stamp}`,
    "",
    `Model: ${results.find((r) => r.model)?.model || "unknown"}. Cases: ${new Set(results.map((r) => r.case)).size}. Rules as of ${bench.rulesAsOf}. "Model-judged" counts only the schemes code left open for Beam.`,
    "",
    "## Accuracy per scheme",
    "",
    `| Scheme | ${efforts.map((e) => `${e} (all) | ${e} (model-judged)`).join(" | ")} |`,
    `| --- | ${efforts.map(() => "--- | ---").join(" | ")} |`,
  ];
  const acc = (
    effort: Effort,
    scheme: SchemeId | null,
    modelOnly: boolean,
  ): string => {
    let n = 0;
    let d = 0;
    for (const r of results.filter((x) => x.effort === effort)) {
      const c = byCase.get(r.case);
      if (!c) continue;
      for (const s of SCHEMES) {
        if (scheme && s.id !== scheme) continue;
        if (modelOnly && c.expected[s.id].settledBy !== "model") continue;
        d++;
        if (r.right[s.id]) n++;
      }
    }
    return pct(n, d);
  };
  for (const s of SCHEMES)
    lines.push(
      `| ${s.name} | ${efforts.map((e) => `${acc(e, s.id, false)} | ${acc(e, s.id, true)}`).join(" | ")} |`,
    );
  lines.push(
    `| **All schemes** | ${efforts.map((e) => `**${acc(e, null, false)}** | **${acc(e, null, true)}**`).join(" | ")} |`,
  );

  lines.push(
    "",
    "## Tokens and quotes per effort",
    "",
    "| Effort | Checks | Errors | Avg input tokens | Avg output tokens | Quote verified | Avg seconds |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const e of efforts) {
    const rs = results.filter((r) => r.effort === e);
    const avg = (f: (r: CaseResult) => number): string =>
      rs.length
        ? Math.round(
            rs.reduce((a, r) => a + f(r), 0) / rs.length,
          ).toLocaleString("en-GB")
        : "-";
    const proposed = rs.reduce((a, r) => a + r.quotes.proposed, 0);
    const verified = rs.reduce((a, r) => a + r.quotes.verified, 0);
    lines.push(
      `| ${e} | ${rs.length} | ${rs.filter((r) => r.error).length} | ${avg((r) => r.tokens.input)} | ${avg((r) => r.tokens.output)} | ${pct(verified, proposed)} | ${avg((r) => r.ms / 1000)} |`,
    );
  }
  lines.push("", "Raw lines: the matching `.jsonl` file in this folder.", "");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      effort: { type: "string" },
      cases: { type: "string" },
      limit: { type: "string" },
    },
  });
  if (!process.env.HF_TOKEN && !process.env.BEAM_API_KEY) {
    console.log(
      "BenefitsBench skipped: set HF_TOKEN (or BEAM_API_KEY for your own endpoint) to run the agent on Beam.",
    );
    console.log(
      "The deterministic half runs without a token: pnpm --filter @beacon/evals test",
    );
    return;
  }
  const mod = (await import(BRAIN)) as { runCheck?: RunCheck };
  if (typeof mod.runCheck !== "function")
    throw new Error(`${BRAIN} does not export runCheck yet`);

  const bench = loadBench();
  const today = benchToday(bench);
  const efforts = values.effort
    ? (values.effort.split(",") as Effort[])
    : EFFORTS;
  const pick = values.cases?.split(",");
  const cases = bench.cases
    .filter((c) => !pick || pick.includes(c.id))
    .slice(0, values.limit ? Number(values.limit) : undefined);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await mkdir(OUT_DIR, { recursive: true });
  const jsonl = join(OUT_DIR, `${stamp}.jsonl`);
  const results: CaseResult[] = [];
  for (const effort of efforts)
    for (const c of cases) {
      const r = await runOne(mod.runCheck, c, effort, today);
      results.push(r);
      await writeFile(jsonl, `${JSON.stringify(r)}\n`, { flag: "a" });
      const right = Object.values(r.right).filter(Boolean).length;
      console.log(
        `${effort.padEnd(6)} ${c.id.padEnd(40)} ${right}/${SCHEMES.length} right, ${r.tokens.input + r.tokens.output} tokens${r.error ? `, error: ${r.error}` : ""}`,
      );
    }
  await writeFile(
    join(OUT_DIR, "summary.md"),
    summarise(bench, results, stamp),
  );
  console.log(`Wrote ${jsonl} and ${join(OUT_DIR, "summary.md")}`);
}

if (import.meta.main) await main();
