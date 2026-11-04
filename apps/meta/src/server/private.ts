import "server-only";

// The privacy step before anything reaches a hosted model. Each new message from the person is
// first passed through one of Meta's open-weights models: our own host if OPEN_WEIGHTS_* is set
// (vLLM on Modal, say), then Muse Spark Open on Baseten, then Muse Glimmer on Fireworks. It removes names,
// street addresses, ID and account numbers, phone numbers and emails, and keeps what a check
// needs (ages, postcode or ZIP code, amounts, relationships). Without that host configured, the
// same rules run as plain code, so nothing personal leaves in either case.

interface Host {
  base: string | undefined;
  key: string | undefined;
  model: string;
  name: string;
}
// Tried in order; the first host that answers wins, so one host going down never blocks a check.
const HOSTS: Host[] = [
  {
    base: process.env.OPEN_WEIGHTS_BASE_URL,
    key: process.env.OPEN_WEIGHTS_API_KEY,
    model: process.env.OPEN_WEIGHTS_MODEL || "muse-glimmer",
    name: process.env.OPEN_WEIGHTS_NAME || "Muse Glimmer",
  },
  {
    base: "https://inference.baseten.co/v1",
    key: process.env.BASETEN_API_KEY,
    model: process.env.BASETEN_MODEL || "meta-models/muse-spark-open-1026",
    name: "Muse Spark Open on Baseten",
  },
  {
    base: "https://api.fireworks.ai/inference/v1",
    key: process.env.FIREWORKS_API_KEY,
    model:
      process.env.FIREWORKS_MODEL ||
      "accounts/fireworks/models/muse-glimmer-30b",
    name: "Muse Glimmer on Fireworks",
  },
].filter((h) => h.base && h.key);

/** Which open-weights models can run the privacy step, first choice first. */
export const openWeightsNames = HOSTS.map((h) => h.name);

// Shapes that are never needed for a check: UK National Insurance, US Social Security, card
// and account numbers, sort codes, phone numbers, emails.
const PATTERNS: [RegExp, string][] = [
  [/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, "[ID number]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[ID number]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[card or account number]"],
  [/\b\d{2}-\d{2}-\d{2}\b/g, "[sort code]"],
  [/\b\d{8}\b/g, "[account number]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/(?:\+44\s?|\b0)(?:\d[\s-]?){9,10}\b/g, "[phone]"],
  [/\b\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone]"],
];

export function scrubText(text: string): string {
  return PATTERNS.reduce((t, [re, to]) => t.replace(re, to), text);
}

export const openWeightsOn = (): boolean => HOSTS.length > 0;

const SYSTEM =
  "Rewrite the user's message with personal identifiers removed, and change nothing else. Replace people's names with their relationship if it is clear (my mum, my dad) or with [name]. Replace a street address with [address] but keep a postcode or ZIP code. Replace National Insurance, Social Security, card, bank account and sort code numbers, phone numbers and emails with [removed]. Keep ages, dates of birth by month and year, amounts of money, health needs, places like towns, and everything else exactly as written. Reply with the rewritten message only.";

async function ask(h: Host, text: string): Promise<string> {
  const res = await fetch(`${h.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${h.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: h.model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("empty");
  return out;
}

/** One message through an open-weights model, then the code rules as a safety net. */
export async function redact(
  text: string,
): Promise<{ text: string; by: string | null }> {
  for (const h of HOSTS) {
    try {
      const out = await ask(h, text);
      // The code rules run on the model's output too: two independent layers.
      return { text: scrubText(out), by: h.name };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "open_weights_failed",
          model: h.model,
          err: String(err).slice(0, 200),
        }),
      );
    }
  }
  return { text: scrubText(text), by: null };
}
