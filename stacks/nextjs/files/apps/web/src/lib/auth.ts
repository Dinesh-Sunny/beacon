import {
  AUTH_ENV,
  type Auth,
  BILLING_ENV,
  createAuth,
  resolveAuthOrigins,
} from "@__NAME__/auth";
import { isEmailConfigured } from "@__NAME__/email";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { sendAuthEmail } from "@/lib/auth-email";
import { handleAuthEvent } from "@/lib/auth-events";
import { isBotRequest } from "@/lib/bot-protection";
import { SITE } from "@/lib/site";
import { enqueueAuthJob } from "@/payload/jobs/enqueue";

function requiredSecret(): string {
  const secret = process.env[AUTH_ENV.secret];
  if (!secret) {
    throw new Error(`${AUTH_ENV.secret} is not set. See apps/web/.env.example`);
  }
  return secret;
}

// Both Stripe values or neither: a key without a webhook secret would take payments whose
// outcome never reaches the database.
function stripeConfig():
  | { secretKey: string; webhookSecret: string }
  | undefined {
  const secretKey = process.env[BILLING_ENV.secretKey];
  const webhookSecret = process.env[BILLING_ENV.webhookSecret];
  if (!secretKey && !webhookSecret) return undefined;
  if (!secretKey || !webhookSecret) {
    throw new Error(
      `Set both ${BILLING_ENV.secretKey} and ${BILLING_ENV.webhookSecret}, or neither. See docs/knowledge/payments.md`,
    );
  }
  return { secretKey, webhookSecret };
}

let instance: Auth | undefined;

// Without a provider, Better Auth sends most auth emails in the background and only logs the
// failure, so sign-ups look fine while nobody can verify. Say so once per instance, loudly;
// /api/health reports it too.
function warnIfEmailUnconfigured(): void {
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    console.error(
      "[auth] email is not configured: verification, reset, and invitation emails will not send. See docs/knowledge/email.md",
    );
  }
}

// Lazy: creating the instance opens the database pool, which `next build` must not need.
export function getAuth(): Auth {
  if (!instance) warnIfEmailUnconfigured();
  instance ??= createAuth({
    appName: SITE.name,
    secret: requiredSecret(),
    // Only this environment's own hosts (see packages/auth/src/origins.ts).
    origins: resolveAuthOrigins(),
    sendEmail: sendAuthEmail,
    stripe: stripeConfig(),
    // Failed emails and Stripe cancellations become retried Payload jobs.
    enqueue: enqueueAuthJob,
    onEvent: handleAuthEvent,
    // Vercel BotID on sign-up, sign-in, reset, and invite requests (lib/bot-protection.ts).
    isBot: isBotRequest,
    // Emails and other deferred work finish after the response instead of being cut off when
    // the function suspends.
    runInBackground: (promise) => after(promise),
    // Lets Server Actions set auth cookies; must stay the last plugin.
    plugins: [nextCookies()],
  });
  return instance;
}
