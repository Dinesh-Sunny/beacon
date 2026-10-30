// "What do I do next?" for one finding: next steps, what to have ready, and a call script or letter,
// written by Beam at medium effort from the scheme's own claim route.

import { type Finding, schemeById } from "@beacon/rules";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { EFFORT, loadBeamEnv } from "./config.ts";
import { invokeText, stepModels, type Usage } from "./model.ts";
import { EXPLAIN_PROMPT, explainTask } from "./prompts/explain.ts";

export interface ExplainOptions {
  signal?: AbortSignal;
  model?: BaseChatModel;
  env?: Record<string, string | undefined>;
}

export interface Explanation {
  text: string;
  usage: Usage & { step: "explain"; effort: (typeof EFFORT)["explain"] };
}

/** Plain-text next steps and a draft letter or call script for one settled finding. */
export async function explainFinding(
  finding: Finding,
  opts: ExplainOptions = {},
): Promise<Explanation> {
  const scheme = schemeById(finding.scheme);
  const models = stepModels(
    opts.model ? undefined : loadBeamEnv(opts.env),
    "explain",
    opts.model,
  );
  const { text, usage } = await invokeText(
    models,
    [
      { role: "system", content: EXPLAIN_PROMPT },
      { role: "user", content: explainTask(finding, scheme) },
    ],
    opts.signal,
  );
  return {
    text: text.trim(),
    usage: { ...usage, step: "explain", effort: EFFORT.explain },
  };
}
