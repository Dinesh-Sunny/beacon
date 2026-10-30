// Deterministic half of BenefitsBench: everything code settles before Beam reads a page must match the
// rules-based expectations today. No model, no network.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type CheckEvent, precheck, SCHEMES, VERDICTS } from "@beacon/rules";
import { benchToday, loadBench } from "../dataset.ts";

const bench = loadBench();
const today = benchToday(bench);

describe("BenefitsBench dataset shape", () => {
  it("has 30 cases with unique ids", () => {
    assert.equal(bench.cases.length, 30);
    assert.equal(new Set(bench.cases.map((c) => c.id)).size, 30);
  });
  it("every case has an expectation for every scheme, with known verdicts", () => {
    for (const c of bench.cases)
      for (const s of SCHEMES) {
        const e = c.expected[s.id];
        assert.ok(e, `${c.id} is missing ${s.id}`);
        assert.ok(
          VERDICTS.includes(e.verdict),
          `${c.id}/${s.id}: ${e.verdict}`,
        );
        for (const v of e.alsoAccept ?? [])
          assert.ok(VERDICTS.includes(v), `${c.id}/${s.id}: ${v}`);
      }
  });
});

describe("precheck agrees with the rules-based expectations", () => {
  for (const c of bench.cases) {
    const got = Object.fromEntries(
      precheck(c.situation, today).map((p) => [p.scheme, p.status]),
    );
    for (const s of SCHEMES) {
      const e = c.expected[s.id];
      const want =
        e.settledBy === "model"
          ? "open"
          : e.verdict === "already-get"
            ? "already-get"
            : "ruled-out";
      // A known gap still runs, but reports as a todo instead of failing the build.
      it(`${c.id} / ${s.id} is ${want}`, { todo: e.knownRulesGap }, () =>
        assert.equal(got[s.id], want),
      );
    }
  }
});

describe("runner scoring with a stand-in agent", () => {
  it("scores precheck-settled schemes and summarises without a model", async () => {
    const { runOne, summarise } = await import("../run.ts");
    const c = bench.cases[0];
    assert.ok(c);
    const stub = async function* (): AsyncGenerator<CheckEvent> {
      yield {
        type: "usage",
        step: "judge",
        effort: "high",
        inputTokens: 1000,
        outputTokens: 50,
      };
      yield { type: "done", findings: [], model: "stub", snapshot: true };
    };
    const r = await runOne(stub, c, "high", today);
    assert.equal(r.tokens.input, 1000);
    assert.equal(r.right["universal-credit"], true);
    assert.equal(r.right["pension-credit"], false);
    assert.match(
      summarise(bench, [r], "test"),
      /\| high \| 1 \| 0 \| 1,000 \| 50 \| - \|/,
    );
  });
});
