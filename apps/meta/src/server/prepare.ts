import "server-only";

// "Prepare my call": Muse Spark writes what to say and what to have ready for one scheme.
// It sees only that scheme's rules and the answers those rules read. Phone numbers and links
// come from code, never from the model.

import { z } from "zod";
import { type Answers, FACTS, type FactId, formatAnswer } from "@/engine/facts";
import { byId, evaluate } from "@/engine/rules";
import { chat } from "./meta";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    opening: { type: "string", description: "One or two sentences to say when the call is answered" },
    mention: { type: "array", items: { type: "string" }, description: "Up to 4 facts worth saying, in plain words" },
    have_ready: { type: "array", items: { type: "string" }, description: "Up to 5 things to have to hand" },
    they_may_ask: { type: "array", items: { type: "string" }, description: "Up to 3 questions they may ask" },
  },
  required: ["opening", "mention", "have_ready", "they_may_ask"],
};

const Out = z.object({
  opening: z.string().max(400),
  mention: z.array(z.string().max(200)).max(6),
  have_ready: z.array(z.string().max(200)).max(6),
  they_may_ask: z.array(z.string().max(200)).max(4),
});

const NO_DIGITS_LONG = /\b\d{5,}\b/g;

export async function prepareCall(schemeId: string, answers: Answers) {
  const s = byId[schemeId];
  if (!s) return null;
  const st = evaluate(answers)[s.id];
  const needs = [...new Set(s.rule.flatMap((r) => r.needs))] as FactId[];
  const facts = needs
    .filter((f) => answers[f] !== undefined)
    .map((f) => `${FACTS[f].label}: ${formatAnswer(f, answers[f])}`);
  const { message } = await chat({
    messages: [
      {
        role: "system",
        content:
          "You help someone in the UK get ready to claim support. Write in plain, warm UK English, short lines, a normal hyphen never a long dash. Use only the facts given. Don't promise an outcome: the organisation decides. No phone numbers, no web links, no amounts unless they are in the facts.",
      },
      {
        role: "user",
        content: `Scheme: ${s.name}, run by ${s.by}. What it gives: ${s.gives}. How to claim: ${s.how}. ${s.timing ?? ""}
Conditions: ${s.rule.map((r, i) => `${r.txt} (${st?.marks[i] === true ? "met" : st?.marks[i] === false ? "not met" : "not known"})`).join("; ")}.
Their answers: ${facts.join("; ") || "none yet"}.
Write what they should say and have ready.`,
      },
    ],
    schema: { name: "call_prep", schema: SCHEMA },
    effort: "low",
    maxTokens: 2000,
  });
  const out = Out.parse(JSON.parse(message.content ?? "{}"));
  const clean = (t: string) => t.replace(NO_DIGITS_LONG, "").replace(/—/g, "-");
  return {
    opening: clean(out.opening),
    mention: out.mention.slice(0, 4).map(clean),
    have_ready: out.have_ready.slice(0, 5).map(clean),
    they_may_ask: out.they_may_ask.slice(0, 3).map(clean),
    phone: s.phone ?? null,
    url: s.url,
  };
}
