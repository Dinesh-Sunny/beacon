// "Explain my letter": plain meaning, deadline, next step and scam signs for a pasted letter,
// written by Beam at medium effort. Identifiers are removed in code before the model sees the text.

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { EFFORT, LIMITS, loadBeamEnv } from "./config.ts";
import { invokeText, stepModels, type Usage } from "./model.ts";
import { LETTER_PROMPT, letterTask } from "./prompts/letter.ts";

export interface LetterOptions {
  signal?: AbortSignal;
  model?: BaseChatModel;
  env?: Record<string, string | undefined>;
}

export interface LetterExplanation {
  text: string;
  /** How many identifiers were removed before Beam read the letter */
  removed: number;
  usage: Usage & { step: "explain"; effort: (typeof EFFORT)["explain"] };
}

// National Insurance numbers (QQ 12 34 56 C), sort codes (12-34-56) and long digit runs (account,
// card and reference numbers). UK phone numbers stay: they matter for the scam check.
const IDENTIFIERS: Array<[RegExp, string]> = [
  [/\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, "[NI number]"],
  [/\b\d{2}-\d{2}-\d{2}\b/g, "[sort code]"],
  [/\b\d{8,}\b/g, "[number]"],
];

const UK_PHONE = /^0\d{9,10}$/;

/** Removes identifiers Beacon never needs. Returns the cleaned text and how many were removed. */
export function redactLetter(text: string): { text: string; removed: number } {
  let removed = 0;
  let out = text;
  for (const [pattern, label] of IDENTIFIERS)
    out = out.replace(pattern, (match) => {
      if (label === "[number]" && UK_PHONE.test(match)) return match;
      removed += 1;
      return label;
    });
  return { text: out, removed };
}

export async function explainLetter(
  letter: string,
  opts: LetterOptions = {},
): Promise<LetterExplanation> {
  const clean = redactLetter(letter.slice(0, LIMITS.letterChars));
  const models = stepModels(
    opts.model ? undefined : loadBeamEnv(opts.env),
    "explain",
    opts.model,
  );
  const { text, usage } = await invokeText(
    models,
    [
      { role: "system", content: LETTER_PROMPT },
      { role: "user", content: letterTask(clean.text) },
    ],
    opts.signal,
  );
  return {
    text: text.trim(),
    removed: clean.removed,
    usage: { ...usage, step: "explain", effort: EFFORT.explain },
  };
}
