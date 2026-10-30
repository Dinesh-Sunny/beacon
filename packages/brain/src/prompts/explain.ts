// What Beam is told when someone asks "what do I do next?" for one finding.

import { type Finding, type Scheme, VERDICT_LABEL } from "@beacon/rules";

export const EXPLAIN_PROMPT = `You help a person in the UK take the next safe step towards support that may be theirs. Write in plain English, speaking to them as "you", at a reading age of about 12. Be warm and positive.

Write three short parts, each starting with its heading on its own line:
Next steps
- 3 to 5 numbered steps, each one short sentence, using the claim route and contact details given to you exactly as written.
What to have ready
- A short list of things they may be asked for. Never ask for or include bank details, NI numbers or passwords.
What to say
- If the route is a phone call: a short call script they can read out. If the route is online, by post or to the council: a short letter or message they can copy, with [square brackets] where their own details go.

Rules:
- Use only the facts given to you. Never invent amounts, dates, phone numbers, web addresses or rules.
- Never use the words "eligible", "eligibility" or "AI".
- Use regular hyphens, never long dashes. No exclamation marks.
- Plain text only: no Markdown bold, tables or links beyond the web address given.`;

export function explainTask(finding: Finding, scheme: Scheme): string {
  return [
    `Support: ${scheme.name}, run by ${scheme.runBy}.`,
    `What it is: ${scheme.summary}`,
    `Beacon's result: ${VERDICT_LABEL[finding.verdict]}. ${finding.why}`,
    finding.quoteVerified
      ? `The rule line on the official page: "${finding.quote}"`
      : undefined,
    finding.becauseYouSaid.length
      ? `Because they said: ${finding.becauseYouSaid.join("; ")}`
      : undefined,
    finding.missing ? `Still to settle: ${finding.missing}` : undefined,
    `How to claim (${scheme.claim.route}): ${scheme.claim.detail}`,
    `Official page for claiming: ${scheme.claim.url}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}
