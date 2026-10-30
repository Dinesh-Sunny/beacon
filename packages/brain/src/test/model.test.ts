import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadBeamEnv } from "../config.ts";
import { getRules, listSchemes } from "../mcp.ts";
import {
  createBeamModel,
  resetEffortSupport,
  type StepModels,
  sendsEffort,
  withEffortFallback,
} from "../model.ts";
import { FakeBeam, fakeGovuk } from "./fakes.ts";

describe("Beam model", () => {
  it("reads env with the HF router default and BEAM_API_KEY over HF_TOKEN", () => {
    const env = loadBeamEnv({ HF_TOKEN: "hf", BEAM_API_KEY: "" });
    assert.equal(env.baseUrl, "https://router.huggingface.co/v1");
    assert.equal(env.model, "reflection/Beam-1.0-501B-A23B");
    assert.equal(env.apiKey, "hf");
    assert.equal(
      loadBeamEnv({ HF_TOKEN: "hf", BEAM_API_KEY: "beam" }).apiKey,
      "beam",
    );
  });

  it("puts reasoning_effort in the request body for a non-OpenAI model id", () => {
    const env = loadBeamEnv({ HF_TOKEN: "x" });
    const params = createBeamModel(env, "judge").invocationParams() as Record<
      string,
      unknown
    >;
    assert.equal(params.reasoning_effort, "high");
    assert.equal(params.model, "reflection/Beam-1.0-501B-A23B");
    assert.equal(
      (
        createBeamModel(env, "judge", false).invocationParams() as Record<
          string,
          unknown
        >
      ).reasoning_effort,
      undefined,
    );
  });

  it("falls back once without effort when the endpoint rejects it", async () => {
    resetEffortSupport();
    const preferred = new FakeBeam({});
    const plain = new FakeBeam({});
    const m: StepModels = { step: "judge", preferred, plain };
    const used: unknown[] = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      const out = await withEffortFallback(m, async (model) => {
        used.push(model);
        if (model === preferred)
          throw Object.assign(
            new Error("Unsupported parameter: reasoning_effort"),
            { status: 400 },
          );
        return "ok";
      });
      assert.equal(out, "ok");
      assert.deepEqual(used, [preferred, plain]);
      assert.equal(sendsEffort(), false);
    } finally {
      console.warn = warn;
      resetEffortSupport();
    }
  });
});

describe("MCP functions", () => {
  it("lists every scheme", () => assert.equal(listSchemes().length, 10));

  it("reads rules live, then falls back to the snapshot", async () => {
    const live = await getRules(
      { scheme: "pension-credit" },
      { fetcher: fakeGovuk({ "/pension-credit": "<p>Live text here.</p>" }) },
    );
    assert.equal(live.snapshot, false);
    assert.match(live.text, /Live text here/);

    const dir = mkdtempSync(join(tmpdir(), "beacon-snap-"));
    const page = {
      path: "/pension-credit",
      url: "https://www.gov.uk/pension-credit",
      title: "Pension Credit",
      text: "Snapshot text.",
      publicUpdatedAt: "",
      readAt: "2026-10-30",
    };
    writeFileSync(join(dir, "pension-credit.json"), JSON.stringify(page));
    const snap = await getRules(
      { scheme: "pension-credit" },
      { fetcher: fakeGovuk({}), snapshotDir: dir },
    );
    assert.equal(snap.snapshot, true);
    assert.match(snap.text, /Snapshot text/);
  });

  it("rejects an unknown scheme at the boundary", async () => {
    await assert.rejects(
      getRules({ scheme: "free-money" as "pension-credit" }),
    );
  });
});
