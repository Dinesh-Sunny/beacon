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

// Removed before Beam reads a letter: NI numbers, card numbers, sort codes, account and reference
// numbers, full postcodes, and the greeting line (it usually holds the name). Order matters: longer
// patterns run first. UK phone numbers stay when the letter says to call them, for the scam check.
const IDENTIFIERS: Array<[RegExp, string]> = [
  [/\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, "[NI number]"],
  [/\b(?:\d[ -]?){12,18}\d\b/g, "[card number]"],
  [/\b\d{2}[ -]\d{2}[ -]\d{2}\b/g, "[sort code]"],
  [/\b\d{4}[ -]?\d{4}\b/g, "[number]"],
  [/\b\d{8,}\b/g, "[number]"],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[postcode]"],
  [/^\s*(?:Dear|Mr|Mrs|Ms|Miss|Mx|Dr)\b.*$/gim, "[greeting]"],
];

const UK_PHONE = /^0\d{9,10}$/;
const CALL_WORDS = /\b(?:call|phone|tel|telephone|ring|contact)\b[^\n]{0,30}$/i;

/** Removes identifiers Beacon never needs. Returns the cleaned text and how many were removed. */
export function redactLetter(text: string): { text: string; removed: number } {
  let removed = 0;
  let out = text;
  for (const [pattern, label] of IDENTIFIERS)
    out = out.replace(pattern, (match: string, ...rest: unknown[]) => {
      const offset = rest.find((x) => typeof x === "number") as number;
      const before = out.slice(Math.max(0, offset - 40), offset);
      const digits = match.replace(/[ -]/g, "");
      if (UK_PHONE.test(digits) && CALL_WORDS.test(before)) return match;
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
