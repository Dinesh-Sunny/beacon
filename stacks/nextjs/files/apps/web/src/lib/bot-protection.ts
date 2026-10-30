import { checkBotId } from "botid/server";

// BotID only works on Vercel: elsewhere (`next start`, self-hosting, CI) checkBotId calls
// Vercel's API and throws, so the check is skipped there. On Vercel, a BotID outage lets the
// request through (fail open) and is logged: sign-in, rate limits, and auth still apply, and
// locking every user out is worse than a short window of unchecked traffic.
export const BOT_PROTECTION_ENABLED = Boolean(process.env.VERCEL);

export async function isBotRequest(): Promise<boolean> {
  if (!BOT_PROTECTION_ENABLED) return false;
  try {
    return (await checkBotId()).isBot;
  } catch (error) {
    console.error("[bot-protection] check failed, request allowed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
