import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  type CheckEvent,
  type Finding,
  SCHEMES,
  type SchemeId,
  type Situation,
} from "@beacon/rules";
import { MESSAGES, runCheck } from "../check.ts";
import { describeSituation } from "../prompts/judge.ts";
import { stripLinePrefix } from "../tools.ts";
import { FakeBeam, type FakeLog, fakeGovuk, type Script } from "./fakes.ts";

const TODAY = new Date(Date.UTC(2026, 9, 30));
// An empty folder, so a failed live read cannot fall back to a real snapshot.
const NO_SNAPSHOT = mkdtempSync(join(tmpdir(), "beacon-snap-"));

// The sample person: Brent, born 1952, lives alone, council tenant, income under the line.
const sample: Situation = {
  forSomeoneElse: false,
  postcodeDistrict: "HA9",
  nation: "england",
  council: "Brent",
  birthYear: 1952,
  household: "alone",
  benefits: [],
  home: "council-or-housing-association",
  pensionIncome: "under-line",
  savings: "under-10000",
  applies: ["health-condition"],
};

const PC_LINE =
  "Pension Credit tops up your weekly income to £238 if you are single.";
const AA_LINE =
  "You must need help with personal care or supervision because of a disability.";
const generic = (name: string): string =>
  `<p>${name} is for people who meet the rules on this page and live in England.</p>`;

const bodies: Record<string, string> = Object.fromEntries(
  SCHEMES.map((s) => [s.govukPaths[0] ?? "", generic(s.name)]),
);
bodies["/pension-credit"] =
  `<h2>Eligibility</h2><p>You must have reached State Pension age.</p><p>${PC_LINE}</p>`;
bodies["/attendance-allowance"] = `<p>${AA_LINE}</p>`;

const worth = (quote: string): Script => ({
  verdict: "worth-checking",
  why: "It could be yours.",
  quote,
  becauseYouSaid: [],
});

function scripts(
  overrides: Partial<Record<SchemeId, Script>> = {},
): Partial<Record<SchemeId, Script>> {
  const base = Object.fromEntries(
    SCHEMES.map((s) => [
      s.id,
      worth(`${s.name} is for people who meet the rules on this page`),
    ]),
  );
  return { ...base, ...overrides };
}

async function collect(
  situation: Situation,
  model: FakeBeam,
  extra: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    stopAfter?: (e: CheckEvent) => boolean;
  } = {},
) {
  const events: CheckEvent[] = [];
  for await (const e of runCheck(situation, {
    model,
    modelName: "fake-beam",
    fetcher: extra.fetcher ?? fakeGovuk(bodies),
    snapshotDir: NO_SNAPSHOT,
    today: TODAY,
    signal: extra.signal,
  })) {
    events.push(e);
    if (extra.stopAfter?.(e)) break;
  }
  return events;
}

const findingFor = (
  events: CheckEvent[],
  scheme: SchemeId,
): Finding | undefined =>
  events.flatMap((e) =>
    e.type === "finding" && e.finding.scheme === scheme ? [e.finding] : [],
  )[0];

describe("runCheck", () => {
  it("streams precheck, plan, settled findings, reading, findings, usage, then done", async () => {
    const log: FakeLog = { calls: [] };
    const model = new FakeBeam(
      scripts({
        "pension-credit": {
          verdict: "likely",
          why: "Your income is under the line.",
          quote: PC_LINE,
          becauseYouSaid: ["You live alone"],
        },
      }),
      { log },
    );
    const events = await collect(sample, model);
    const types = events.map((e) => e.type);
    assert.equal(types[0], "precheck");
    assert.equal(types[1], "plan");
    assert.equal(types.at(-1), "done");

    const plan = events[1];
    assert.ok(plan?.type === "plan");
    assert.deepEqual(
      new Set(plan.schemes),
      new Set([
        "pension-credit",
        "council-tax-reduction",
        "warm-home-discount",
        "attendance-allowance",
        "housing-benefit",
        "winter-fuel-payment",
      ]),
    );

    // Code-settled findings come before any reading.
    const firstReading = types.indexOf("reading");
    const settled = events
      .slice(0, firstReading)
      .filter((e) => e.type === "finding");
    assert.equal(settled.length, SCHEMES.length - plan.schemes.length);

    for (const scheme of plan.schemes) {
      const idx = (pred: (e: CheckEvent) => boolean) => events.findIndex(pred);
      const reading = idx(
        (e) =>
          e.type === "reading" && e.scheme === scheme && e.status === "reading",
      );
      const done = idx(
        (e) =>
          e.type === "reading" && e.scheme === scheme && e.status === "done",
      );
      const finding = idx(
        (e) => e.type === "finding" && e.finding.scheme === scheme,
      );
      const usage = idx((e) => e.type === "usage" && e.scheme === scheme);
      assert.ok(
        reading >= 0 && reading < done && done < finding && finding < usage,
        `order for ${scheme}`,
      );
      const u = events[usage];
      assert.ok(
        u?.type === "usage" &&
          u.step === "judge" &&
          u.effort === "high" &&
          u.inputTokens === 200 &&
          u.outputTokens === 20,
      );
    }

    const pc = findingFor(events, "pension-credit");
    assert.equal(pc?.verdict, "likely");
    assert.equal(pc?.quoteVerified, true);
    assert.equal(pc?.source.url, "https://www.gov.uk/pension-credit");

    const done = events.at(-1);
    assert.ok(done?.type === "done");
    assert.equal(done.findings.length, SCHEMES.length);
    assert.equal(done.findings[0]?.verdict, "likely");
    assert.equal(done.model, "fake-beam");
    assert.equal(done.snapshot, false);

    // The reader read the page from its filesystem, and every call had to use a tool.
    const pcCalls = log.calls.filter((c) => c.scheme === "pension-credit");
    assert.equal(pcCalls.length, 2);
    assert.equal(pcCalls[1]?.sawPage, true);
    assert.ok(pcCalls.every((c) => c.toolChoice === "required"));
  });

  it("downgrades a Likely whose quote is not on the page, and keeps one copied with a line number", async () => {
    const model = new FakeBeam(
      scripts({
        "attendance-allowance": {
          verdict: "likely",
          why: "You need help.",
          quote: "You will definitely get £110 a week for help with care.",
          becauseYouSaid: [],
        },
        "pension-credit": {
          verdict: "likely",
          why: "Under the line.",
          quote: `     4\t${PC_LINE}`,
          becauseYouSaid: [],
        },
      }),
    );
    const events = await collect(sample, model);
    const aa = findingFor(events, "attendance-allowance");
    assert.equal(aa?.verdict, "worth-checking");
    assert.equal(aa?.quoteVerified, false);
    const pc = findingFor(events, "pension-credit");
    assert.equal(pc?.verdict, "likely");
    assert.equal(pc?.quoteVerified, true);
    assert.equal(stripLinePrefix(`    12\t${AA_LINE}`), AA_LINE);
  });

  it("settles already-get and ruled-out schemes without reading or calling the model", async () => {
    const log: FakeLog = { calls: [] };
    const events = await collect(
      { ...sample, benefits: ["pension-credit"] },
      new FakeBeam(scripts(), { log }),
    );
    const pc = findingFor(events, "pension-credit");
    assert.equal(pc?.verdict, "already-get");
    assert.equal(pc?.why, "You told us you already get Pension Credit.");
    const ca = findingFor(events, "carers-allowance");
    assert.equal(ca?.verdict, "unlikely-right-now");
    for (const scheme of [
      "pension-credit",
      "carers-allowance",
      "universal-credit",
    ] as const) {
      assert.ok(
        !events.some((e) => e.type === "reading" && e.scheme === scheme),
        `no reading for ${scheme}`,
      );
      assert.ok(
        !log.calls.some((c) => c.scheme === scheme),
        `no model call for ${scheme}`,
      );
    }
  });

  it("forces record_finding on the last allowed call", async () => {
    // A model that never stops reading: the cap must force the finding.
    class Looping extends FakeBeam {
      override bindTools(
        _tools: unknown[],
        kwargs?: { tool_choice?: unknown },
      ): FakeBeam {
        return new Looping(this.scripts, {
          log: this.log,
          toolChoice: kwargs?.tool_choice,
        });
      }
      override async _generate(...args: Parameters<FakeBeam["_generate"]>) {
        const forced =
          (this.toolChoice as { function?: { name?: string } } | undefined)
            ?.function?.name === "record_finding";
        if (forced) return super._generate(...args);
        const [messages] = args;
        const scheme =
          /\(id: ([a-z-]+)\)/.exec(
            messages.map((m) => m.text).join("\n"),
          )?.[1] ?? "";
        this.log.calls.push({
          scheme,
          toolChoice: this.toolChoice,
          sawPage: false,
        });
        const { AIMessage } = await import("@langchain/core/messages");
        const message = new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "grep",
              args: { pattern: "rules" },
              id: `g${this.log.calls.length}`,
              type: "tool_call",
            },
          ],
        });
        return { generations: [{ text: "", message }] };
      }
    }
    const log: FakeLog = { calls: [] };
    const events = await collect(sample, new Looping(scripts(), { log }));
    const calls = log.calls.filter((c) => c.scheme === "winter-fuel-payment");
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.at(-1)?.toolChoice, {
      type: "function",
      function: { name: "record_finding" },
    });
    assert.equal(
      findingFor(events, "winter-fuel-payment")?.verdict,
      "worth-checking",
    );
    assert.equal(events.at(-1)?.type, "done");
  });

  it("stops on abort without done", async () => {
    const controller = new AbortController();
    const model = new FakeBeam(scripts(), { delayMs: 2_000 });
    const started = Date.now();
    const events: CheckEvent[] = [];
    for await (const e of runCheck(sample, {
      model,
      fetcher: fakeGovuk(bodies),
      snapshotDir: NO_SNAPSHOT,
      today: TODAY,
      signal: controller.signal,
    })) {
      events.push(e);
      if (e.type === "reading" && e.status === "done") controller.abort();
    }
    assert.ok(Date.now() - started < 1_500, "returned promptly");
    assert.ok(!events.some((e) => e.type === "done"));
    assert.ok(
      !events.some(
        (e) => e.type === "finding" && e.finding.verdict === "likely",
      ),
    );
  });

  it("sends a warm error when the model cannot be reached", async () => {
    const all = Object.fromEntries(
      SCHEMES.map((s) => [s.id, "throw" as const]),
    );
    const events = await collect(sample, new FakeBeam(all));
    assert.deepEqual(events.at(-1), {
      type: "error",
      message: MESSAGES.unreachable,
    });
    assert.ok(!events.some((e) => e.type === "done"));
  });

  it("sends a warm error when no Beam key is set", async () => {
    const events: CheckEvent[] = [];
    for await (const e of runCheck(sample, {
      env: {},
      today: TODAY,
      fetcher: fakeGovuk(bodies),
      snapshotDir: NO_SNAPSHOT,
    }))
      events.push(e);
    assert.equal(events.at(-1)?.type, "error");
  });

  it("marks a page it cannot read as failed and worth checking", async () => {
    const { "/winter-fuel-payment": _gone, ...rest } = bodies;
    const events = await collect(sample, new FakeBeam(scripts()), {
      fetcher: fakeGovuk(rest),
    });
    assert.ok(
      events.some(
        (e) =>
          e.type === "reading" &&
          e.scheme === "winter-fuel-payment" &&
          e.status === "failed",
      ),
    );
    assert.equal(
      findingFor(events, "winter-fuel-payment")?.why,
      MESSAGES.pageUnavailable,
    );
    assert.equal(events.at(-1)?.type, "done");
  });

  it("describes the answers in bands, with no banned words", () => {
    const text = describeSituation(sample, TODAY).join("\n");
    assert.match(text, /Reached State Pension age: yes/);
    assert.doesNotMatch(text, /eligib/i);
  });
});
