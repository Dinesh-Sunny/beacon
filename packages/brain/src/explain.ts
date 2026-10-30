// "What do I do next?" for one finding: next steps, what to have ready, and a call script or letter,
// written by Beam at medium effort from the scheme's own claim route.

import { type Finding, schemeById, verifyQuote } from "@beacon/rules";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { EFFORT, loadBeamEnv } from "./config.ts";
import { invokeText, stepModels, type Usage } from "./model.ts";
import { EXPLAIN_PROMPT, explainTask } from "./prompts/explain.ts";
import { loadRules, type ReadOptions } from "./tools.ts";

export interface ExplainOptions {
  signal?: AbortSignal;
  model?: BaseChatModel;
  env?: Record<string, string | undefined>;
  /** Re-read the official page and re-check the quote (for findings that came from a browser) */
  reverify?: boolean;
  read?: ReadOptions;
}

export interface Explanation {
  text: string;
  usage: Usage & { step: "explain"; effort: (typeof EFFORT)["explain"] };
}

/**
 * A finding from a browser can be edited or forged (shared links), so its quote is checked again
 * against the page Beacon reads. No verified quote, no Likely: the same rule as settleFinding.
 */
export async function reverifyFinding(
  finding: Finding,
  read: ReadOptions = {},
): Promise<Finding> {
  let quoteVerified = false;
  let source = finding.source;
  try {
    const { page } = await loadRules(finding.scheme, read);
    quoteVerified = verifyQuote(finding.quote, page.text).verified;
    source = {
      url: page.url,
      title: page.title,
      readAt: page.readAt,
      publicUpdatedAt: page.publicUpdatedAt,
    };
  } catch {
    quoteVerified = false;
  }
  const verdict =
    finding.verdict === "likely" && !quoteVerified
      ? "worth-checking"
      : finding.verdict;
  return { ...finding, quoteVerified, verdict, source };
}

/** Plain-text next steps and a draft letter or call script for one settled finding. */
export async function explainFinding(
  finding: Finding,
  opts: ExplainOptions = {},
): Promise<Explanation> {
  const checked = opts.reverify
    ? await reverifyFinding(finding, opts.read)
    : finding;
  const scheme = schemeById(checked.scheme);
  const models = stepModels(
    opts.model ? undefined : loadBeamEnv(opts.env),
    "explain",
    opts.model,
  );
  const { text, usage } = await invokeText(
    models,
    [
      { role: "system", content: EXPLAIN_PROMPT },
      { role: "user", content: explainTask(checked, scheme) },
    ],
    opts.signal,
  );
  return {
    text: text.trim(),
    usage: { ...usage, step: "explain", effort: EFFORT.explain },
  };
}
