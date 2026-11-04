import "server-only";

// The Beacon agent on Muse Spark. It talks, and it acts only through tools: save_details hands
// facts to code, which validates them and runs the rules engine. Every result the person sees
// comes from code; the model explains it in plain words.

import type { Answers } from "@/engine/facts";
import { FACTS } from "@/engine/facts";
import { FACT_PATCH_JSON, FactPatch, toAnswers } from "@/engine/patch";
import { byId, claimOrder, count, evaluate, plan, SCHEMES, summarise, warnings } from "@/engine/rules";
import { type ChatMessage, chat, type Usage } from "./meta";

const SYSTEM = `You are Beacon, a calm and kind helper in the UK. You help people find the money and support they are already entitled to, often for an older parent or someone they care for.

How you work:
- When the person tells you anything about their situation, call save_details with every fact you can read from it. Never guess a fact they did not say. An age is fine when there is no date of birth.
- To talk about results, call check_results. To explain one scheme, call explain_scheme. For the order to claim in, phone numbers and warnings, call plan_claims. Use only what the tools return. Never invent amounts, rules or phone numbers.
- After saving, tell them in one short line what changed, then ask the single next question the tools suggest, in your own warm words.
- Never ask for a name, National Insurance number, bank details or a full address. A postcode is enough.

How you write:
- UK English, plain words, short sentences. Two or three sentences per reply unless they ask for more.
- Say "likely" or "worth checking", never "eligible" or "guaranteed". The organisation that runs each scheme makes the decision.
- Warm and positive. No jargon, no emoji, no lists unless they ask. Use a normal hyphen, never a long dash.
- If someone sounds in crisis or unsafe, say you're sorry it's so hard and point them to call 999 in an emergency or Samaritans on 116 123, free, any time.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "set_who",
      description: "Record who the check is for, as soon as it is clear. Use a short relationship word like Mum, Dad, My partner, or 'me' if it is for themselves.",
      parameters: {
        type: "object",
        properties: { who: { type: "string", description: "'me', or a relationship word of up to 20 letters" } },
        required: ["who"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_details",
      description: "Save facts the person has just told you. Only include fields they actually stated.",
      parameters: FACT_PATCH_JSON,
    },
  },
  {
    type: "function",
    function: {
      name: "check_results",
      description: "Current results from the rules engine: likely, worth checking, unlocks later, still open, and the next useful question.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_scheme",
      description: "Everything Beacon knows about one scheme: what it gives, who runs it, each condition and whether it is met.",
      parameters: {
        type: "object",
        properties: { scheme_id: { type: "string", enum: SCHEMES.map((s) => s.id) } },
        required: ["scheme_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_claims",
      description: "The order to claim in, with how to claim, phone numbers, deadlines and clash warnings.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export interface ToolNote {
  name: string;
  text: string;
}

type Who = { who: "me" | "other"; label?: string };

function runTool(name: string, rawArgs: string, answers: Answers, saved: Answers, notes: ToolNote[], who: { value: Who | null }): string {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({ error: "Arguments were not valid JSON" });
  }
  const now = { ...answers, ...saved };
  if (name === "set_who") {
    const raw = String(args.who ?? "").replace(/[^\p{L} '-]/gu, "").trim().slice(0, 20);
    if (!raw) return JSON.stringify({ error: "Empty" });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    who.value = /^(me|myself|i)$/i.test(raw) ? { who: "me" } : { who: "other", label };
    notes.push({ name, text: who.value.who === "me" ? "Checking for you" : `Checking for ${label}` });
    return JSON.stringify({ ok: true });
  }
  if (name === "save_details") {
    const parsed = FactPatch.safeParse(args);
    if (!parsed.success) return JSON.stringify({ error: "Some fields were not valid", issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")) });
    const patch = toAnswers(parsed.data);
    const keys = Object.keys(patch);
    Object.assign(saved, patch);
    const after = { ...answers, ...saved };
    const st = evaluate(after);
    const nx = plan(after, st);
    notes.push({
      name,
      text: keys.length
        ? `Saved ${keys.length} ${keys.length === 1 ? "detail" : "details"}. Checked ${SCHEMES.length} schemes: ${count(st, "likely")} likely.`
        : "Nothing new to save",
    });
    return JSON.stringify({
      saved: keys.map((k) => FACTS[k as keyof typeof FACTS].label),
      likely: SCHEMES.filter((s) => st[s.id]?.status === "likely").map((s) => s.name),
      worth_checking: SCHEMES.filter((s) => st[s.id]?.status === "check").map((s) => s.name),
      next_question: nx ? { fact: nx.f, ask: FACTS[nx.f].q, why: FACTS[nx.f].why, settles: nx.hits.length } : null,
    });
  }
  const st = evaluate(now);
  if (name === "check_results") {
    notes.push({ name, text: `Checked ${SCHEMES.length} schemes: ${count(st, "likely")} likely, ${count(st, "check")} worth checking` });
    const s = summarise(now, st);
    return JSON.stringify({ ...s, next_question: s.nextQuestion ? FACTS[s.nextQuestion].q : null });
  }
  if (name === "explain_scheme") {
    const s = byId[String(args.scheme_id)];
    if (!s) return JSON.stringify({ error: "Unknown scheme" });
    const state = st[s.id];
    notes.push({ name, text: `Read the rules for ${s.name}` });
    return JSON.stringify({
      name: s.name,
      runs_it: s.by,
      gives: s.gives,
      status: state?.status,
      reason: state?.reason,
      conditions: s.rule.map((r, i) => ({ condition: r.txt, met: state?.marks[i] ?? null })),
      how_to_claim: s.how,
      phone: s.phone ?? null,
      official_page: s.url,
      timing: s.timing ?? null,
      opens: s.opens?.map((o) => byId[o]?.name) ?? [],
    });
  }
  if (name === "plan_claims") {
    const order = claimOrder(st);
    notes.push({ name, text: `Put ${order.length} claims in order and checked for clashes` });
    return JSON.stringify({
      order: order.map((p) => {
        const s = byId[p.id];
        return { scheme: s?.name, when: p.when, how: s?.how, phone: s?.phone ?? null, page: s?.url, timing: s?.timing ?? null };
      }),
      warnings: warnings(st).map((w) => w.text),
    });
  }
  return JSON.stringify({ error: "Unknown tool" });
}

export async function runAgent(
  history: { role: "user" | "assistant"; content: string }[],
  answers: Answers,
  subject: { who: "me" | "other"; label?: string } = { who: "me" },
) {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }];
  messages.push({
    role: "system",
    content:
      subject.who === "other"
        ? `The person is checking for someone they help: "${(subject.label ?? "them").replace(/[^\w '-]/g, "")}". Talk about that person in the third person and save facts about them, not about the helper. If the chat makes clear it's for someone else, call them that.`
        : "The person may be checking for themselves or for someone they help. If they say it's for someone else, talk about that person in the third person.",
  });
  const known = Object.keys(answers).length;
  messages.push({
    role: "system",
    content: known
      ? `Already saved on this device: ${Object.keys(answers)
          .map((k) => FACTS[k as keyof typeof FACTS].label)
          .join(", ")}. Don't ask for these again.`
      : "Nothing is saved yet.",
  });
  for (const m of history) messages.push(m);

  const saved: Answers = {};
  const notes: ToolNote[] = [];
  const who: { value: Who | null } = { value: null };
  const usage: Usage = { prompt_tokens: 0, completion_tokens: 0 };
  for (let round = 0; round < 5; round++) {
    const { message, usage: u } = await chat({ messages, tools: TOOLS, effort: "low", maxTokens: 2500 });
    usage.prompt_tokens += u?.prompt_tokens ?? 0;
    usage.completion_tokens += u?.completion_tokens ?? 0;
    if (!message.tool_calls?.length) {
      return { reply: (message.content ?? "").trim(), saved, notes, usage, subject: who.value };
    }
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      messages.push({ role: "tool", tool_call_id: call.id, content: runTool(call.function.name, call.function.arguments, answers, saved, notes, who) });
    }
  }
  return { reply: "I've saved what you told me. Have a look at the questions on the right whenever you're ready.", saved, notes, usage, subject: who.value };
}
