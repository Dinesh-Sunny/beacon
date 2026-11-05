import "server-only";

// "Prepare my call": Muse Spark writes what to say and what to have ready for one scheme.
// It sees only that scheme's rules and the answers those rules read. Phone numbers and links
// come from code, never from the model.

import { z } from "zod";
import {
  type Answers,
  callerPhrase,
  FACTS,
  type FactId,
  formatAnswer,
} from "@/engine/facts";
import { byId, evaluate, REGISTRY } from "@/engine/rules";
import { cached, keyOf, Lru } from "./cache";
import { chat, META, MetaError } from "./meta";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    opening: {
      type: "string",
      description:
        "The exact words the caller says first, out loud, in the first person: one or two natural sentences naming the scheme and who it's for",
    },
    mention: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 4 facts from their answers that matter for the conditions, in plain words",
    },
    have_ready: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 5 practical things to have to hand for this kind of claim",
    },
    they_may_ask: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 3 questions the call handler will likely ask, with no answers",
    },
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

const notes = new Lru<Awaited<ReturnType<typeof writeNotes>>>(
  5000,
  24 * 60 * 60 * 1000,
);
const inflight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof writeNotes>>>
>();

export async function prepareCall(
  schemeId: string,
  answers: Answers,
  subject: { who: "me" | "other"; label?: string } = { who: "me" },
) {
  const s = byId[schemeId];
  if (!s) return null;
  const needs = [...new Set(s.rule.flatMap((r) => r.needs))] as FactId[];
  const facts = needs
    .filter((f) => answers[f] !== undefined)
    .map((f) => `${FACTS[f].label}: ${formatAnswer(f, answers[f])}`);
  // Same scheme, same rule pack, same relevant answers and same "who": same notes.
  const key = keyOf({
    p: 3,
    s: s.id,
    v: REGISTRY.version,
    facts,
    who: subject.who,
    label: subject.label?.toLowerCase() ?? null,
  });
  const { value, hit } = await cached(notes, inflight, key, () =>
    writeNotes(schemeId, answers, subject, facts),
  );
  return value ? { ...value, cached: hit } : null;
}

async function writeNotes(
  schemeId: string,
  answers: Answers,
  subject: { who: "me" | "other"; label?: string },
  facts: string[],
) {
  const s = byId[schemeId];
  if (!s) return null;
  const st = evaluate(answers)[s.id];
  const us = s.country === "US";
  const request: Parameters<typeof chat>[0] = {
    messages: [
      {
        role: "system",
        content: `You help someone in ${us ? "the United States" : "the UK"} get ready to phone about a claim. Write call notes in plain, warm UK English${us ? ", keeping US programme names exactly as they are" : ""}, short lines, a normal hyphen never a long dash. 'Worth saying' is about the person's own situation (from their answers), never a description of the scheme. 'Have these to hand' lists only what this kind of organisation asks for: a government benefit may want a National Insurance number, bank details and income letters; an energy, broadband or water company usually wants the account number or a recent bill and proof of the benefit. Don't promise an outcome: the organisation decides. No phone numbers or web links. Never use the words eligible or eligibility. Use only facts from their answers: never invent a name, job, role, relationship or amount, and use any name exactly as given.${us ? " A US government programme may want a Social Security number, proof of income and proof of address instead of a National Insurance number." : ""}`,
      },
      {
        role: "user",
        content: `Scheme: ${s.name}, run by ${s.by}. What it gives: ${s.gives}. How to claim: ${s.how}. ${s.timing ?? ""}
Conditions: ${s.rule.map((r, i) => `${r.txt} (${st?.marks[i] === true ? "met" : st?.marks[i] === false ? "not met" : "not known"})`).join("; ")}.
Who it's for: ${subject.who === "me" ? "the caller themselves (write 'I', 'my')" : `someone the caller is helping, so the caller is phoning on their behalf (call them '${callerPhrase(subject)}', then 'they')`}.
Their answers: ${facts.join("; ") || "none yet"}.
Write the call notes.`,
      },
    ],
    schema: { name: "call_prep", schema: SCHEMA },
    effort: "low",
    // The budget counts reasoning too, so give Wonder room to think and still answer.
    maxTokens: 6000,
    cacheKey: "beacon-prepare-v1",
  };
  // Call notes are what people read out on the phone, so they come from Muse Wonder, Meta's
  // stronger reasoning model; Muse Spark answers if Wonder isn't available to this key.
  const read = (content: string | null) => {
    try {
      return Out.parse(JSON.parse(content ?? "{}"));
    } catch {
      return null;
    }
  };
  let out = await chat({ ...request, model: META.wonder })
    .then((r) => read(r.message.content))
    .catch((e: unknown) => {
      if (e instanceof MetaError && e.status < 500 && e.status !== 429)
        return null;
      throw e;
    });
  // Wonder unavailable to this key, or its notes didn't fit the form: Muse Spark writes them.
  if (!out) {
    const { message } = await chat(request);
    out = Out.parse(JSON.parse(message.content ?? "{}"));
  }
  const clean = (t: string) => t.replace(NO_DIGITS_LONG, "").replace(/—/g, "-");
  // The opening is read out on the phone. If the model described it instead of writing it,
  // code writes a plain one.
  const who = callerPhrase(subject);
  const spoken =
    /\bI\b|\bI'm\b/.test(out.opening) &&
    !/\b(opening|setting out|sentences?)\b/i.test(out.opening);
  const opening = spoken
    ? out.opening
    : subject.who === "me"
      ? `Hello, I'm phoning to ask about ${s.name}, please.`
      : `Hello, I'm phoning to ask about ${s.name} for ${who}, please.`;
  return {
    opening: clean(opening),
    mention: out.mention.slice(0, 4).map(clean),
    have_ready: out.have_ready.slice(0, 5).map(clean),
    they_may_ask: out.they_may_ask.slice(0, 3).map(clean),
    phone: s.phone ?? null,
    url: s.url,
  };
}
