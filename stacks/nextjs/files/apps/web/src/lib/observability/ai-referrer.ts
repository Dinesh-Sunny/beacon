// AI assistants and answer engines that send visitors here. Pure so it can be tested; analytics.ts
// tags the session with the source so PostHog can report AI-referred traffic. Add hosts as new
// assistants link out; matching is by host and its subdomains.
export const AI_REFERRER_HOSTS = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "claude.ai": "claude",
  "gemini.google.com": "gemini",
  "copilot.microsoft.com": "copilot",
  "chat.deepseek.com": "deepseek",
  "meta.ai": "meta-ai",
  "chat.mistral.ai": "mistral",
  "you.com": "you",
} as const;

export type AiReferrer =
  (typeof AI_REFERRER_HOSTS)[keyof typeof AI_REFERRER_HOSTS];

// The property PostHog records it under (registered for the session, so every event carries it).
export const AI_REFERRER_PROPERTY = "ai_referrer";

export function aiReferrer(referrer: string): AiReferrer | null {
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [domain, source] of Object.entries(AI_REFERRER_HOSTS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return source;
  }
  return null;
}
