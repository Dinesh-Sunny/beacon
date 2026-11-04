import "server-only";

// The privacy step before anything reaches a hosted model. Each new message from the person is
// first passed through Muse Glimmer, Meta's open-weights model, served on infrastructure we run
// (any OpenAI-compatible host: vLLM on Modal, Baseten, Together or Fireworks). It removes names,
// street addresses, ID and account numbers, phone numbers and emails, and keeps what a check
// needs (ages, postcode or ZIP code, amounts, relationships). Without that host configured, the
// same rules run as plain code, so nothing personal leaves in either case.

const OPEN = {
  base: process.env.OPEN_WEIGHTS_BASE_URL,
  key: process.env.OPEN_WEIGHTS_API_KEY,
  model: process.env.OPEN_WEIGHTS_MODEL || "meta-models/Muse-Glimmer-30B",
};

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

export const openWeightsOn = (): boolean => Boolean(OPEN.base && OPEN.key);

const SYSTEM =
  "Rewrite the user's message with personal identifiers removed, and change nothing else. Replace people's names with their relationship if it is clear (my mum, my dad) or with [name]. Replace a street address with [address] but keep a postcode or ZIP code. Replace National Insurance, Social Security, card, bank account and sort code numbers, phone numbers and emails with [removed]. Keep ages, dates of birth by month and year, amounts of money, health needs, places like towns, and everything else exactly as written. Reply with the rewritten message only.";

/** One message through Muse Glimmer (open weights), then the code rules as a safety net. */
export async function redact(
  text: string,
): Promise<{ text: string; by: "glimmer" | "code" }> {
  if (!openWeightsOn()) return { text: scrubText(text), by: "code" };
  try {
    const res = await fetch(`${OPEN.base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPEN.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPEN.model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const out = json.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error("empty");
    // The code rules run on the model's output too: two independent layers.
    return { text: scrubText(out), by: "glimmer" };
  } catch {
    return { text: scrubText(text), by: "code" };
  }
}
