import * as Sentry from "@sentry/nextjs";
import { initBotId } from "botid/client/core";
import { BOT_PROTECTED_ROUTES } from "@/lib/bot-protection-routes";
import { SENTRY_OPTIONS } from "@/lib/observability/sentry-options";

// Runs before the app hydrates. Replays stay off: they record the screen and need consent.
// PostHog isn't started here: it waits for measurement consent (components/consent).
Sentry.init(SENTRY_OPTIONS);

// Attaches Vercel BotID's challenge headers to the requests the server checks. Vercel builds
// only: elsewhere the server skips the check (lib/bot-protection.ts), and loading the challenge
// from Vercel would only make offline dev and CI sign-ins fail.
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({ protect: [...BOT_PROTECTED_ROUTES] });
}

// Ties client navigations to traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
