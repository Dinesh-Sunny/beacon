// Single source of truth for auth settings shared by the server instance, client, and tests.

// Better Auth tables live in their own Postgres schema, next to `payload` and our `public` tables.
export const AUTH_DB_SCHEMA = "auth";

// Mounted by apps/web at app/api/auth/[...all]; the static `auth` segment wins over Payload's
// /api/[...slug] catch-all.
export const AUTH_BASE_PATH = "/api/auth";

export const AUTH_ENV = {
  secret: "BETTER_AUTH_SECRET",
  url: "BETTER_AUTH_URL",
} as const;

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SESSION_POLICY = {
  expiresInSeconds: 7 * DAY,
  // Sliding refresh at most once a day keeps writes low.
  updateAgeSeconds: DAY,
  // Signed session snapshot in a cookie: fewer DB reads, at the cost of a revoked session
  // staying valid for up to this long.
  cookieCacheMaxAgeSeconds: 5 * MINUTE,
} as const;

export const PASSWORD_POLICY = {
  minLength: 12,
  resetLinkExpiresInSeconds: HOUR,
  // A reset means someone may have had the old password: end every other session.
  revokeSessionsOnReset: true,
} as const;

// "Trust this device" on the two-factor challenge skips the code for this long.
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 30 * DAY;

// Short-lived tokens for the Python sidecar and other services, verified against /api/auth/jwks.
// The audience is fixed (not the request host) so every deployment alias mints the same `aud`;
// __PYNAME___core.auth checks the same value.
export const SERVICE_TOKEN_AUDIENCE = "__NAME__-api";

export const SERVICE_TOKEN_POLICY = {
  expirationTime: "15m",
  rotationIntervalSeconds: 30 * DAY,
  gracePeriodSeconds: 7 * DAY,
} as const;

export const INVITATION_EXPIRES_IN_SECONDS = 2 * DAY;

// How long an expired invitation stays listed before the daily cleanup removes it.
export const INVITATION_RETENTION_DAYS = 30;

// Invitations put an organization name (typed by any user) into email from our domain, so they
// get a tighter per-IP limit than the default: enough to onboard a team, not to spam.
export const INVITE_RATE_LIMIT = { windowSeconds: HOUR, max: 30 } as const;

// Better Auth endpoint the limit applies to (organization plugin).
export const INVITE_MEMBER_PATH = "/organization/invite-member";

// Endpoints that create accounts, start sign-ins, or send email to anyone: checked for bots when
// the app passes `isBot` to createAuth (apps/web: Vercel BotID).
export const BOT_CHECKED_AUTH_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/magic-link",
  "/request-password-reset",
  "/send-verification-email",
  INVITE_MEMBER_PATH,
] as const;

export const BOT_DETECTED_ERROR_CODE = "BOT_DETECTED";

// Namespace for Better Auth's counters in the shared rate-limit store (@__NAME__/ratelimit).
export const AUTH_RATE_LIMIT_SCOPE = "auth";

// Sign-in links work once and expire quickly; the sign-in screen states this window.
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 5 * MINUTE;

// Email verification links (Better Auth's default, made explicit so retries know it).
export const EMAIL_VERIFICATION_EXPIRES_IN_SECONDS = HOUR;

export const API_KEY_PREFIX = "agk_";

// App pages that auth emails link to (built in phase 3b).
export const AUTH_PAGES = {
  acceptInvitation: "/accept-invitation",
  signIn: "/sign-in",
} as const;

// Account deletion is refused with this code while the user is the only owner of an
// organization that has other members; the account screens explain how to hand over.
export const SOLE_OWNER_ERROR_CODE = "SOLE_OWNER_OF_SHARED_ORGANIZATION";

// Every email auth sends. Plain data so client screens (the dev inbox shortcut) can name a kind.
export const AUTH_EMAIL_KINDS = [
  "verify-email",
  "reset-password",
  "magic-link",
  "org-invitation",
  // Someone tried to sign up with an email that already has an account.
  "account-exists",
] as const;

export type AuthEmailKind = (typeof AUTH_EMAIL_KINDS)[number];

// How long each email's link works. A queued retry is dropped after this: a dead link is worse
// than asking for a new one. "account-exists" links to the plain sign-in page.
export const AUTH_EMAIL_LINK_LIFETIME_SECONDS: Record<AuthEmailKind, number> = {
  "verify-email": EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
  "reset-password": PASSWORD_POLICY.resetLinkExpiresInSeconds,
  "magic-link": MAGIC_LINK_EXPIRES_IN_SECONDS,
  "org-invitation": INVITATION_EXPIRES_IN_SECONDS,
  "account-exists": DAY,
};

// Organization billing (Stripe through @better-auth/stripe). Unset: billing is off and every
// organization is on the free tier.
export const BILLING_ENV = {
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
} as const;

// Better Auth endpoint Stripe posts events to (under AUTH_BASE_PATH).
export const STRIPE_WEBHOOK_PATH = "/stripe/webhook";

// The Stripe plugin's subscription endpoints (upgrade, list, cancel, restore, billing portal).
export const SUBSCRIPTION_PATH_PREFIX = "/subscription/";

// What a plan allows. Client projects add their own keys (projects, storage, AI credits).
export type PlanLimits = { seats: number };

// No subscription: free resources stay open; these limits apply.
export const FREE_PLAN = "free";
export const FREE_PLAN_TITLE = "Free";
export const FREE_LIMITS: PlanLimits = { seats: 3 };

// Placeholder plans; client projects rename them. Prices are found by Stripe lookup key, so the
// same code works in a sandbox and in live mode, and one multi-currency price per interval covers
// GBP, EUR, and USD (`pnpm --filter @__NAME__/auth stripe:seed` creates them).
export const PLANS = [
  {
    name: "starter",
    // Shown on the billing page, Stripe Checkout, invoices, and the portal.
    title: "Starter",
    lookupKey: "starter_monthly",
    annualDiscountLookupKey: "starter_annual",
    limits: { seats: 10 },
  },
  {
    name: "pro",
    title: "Pro",
    lookupKey: "pro_monthly",
    annualDiscountLookupKey: "pro_annual",
    limits: { seats: 50 },
  },
] as const satisfies readonly {
  name: string;
  title: string;
  lookupKey: string;
  annualDiscountLookupKey: string;
  limits: PlanLimits;
}[];

export type PlanName = (typeof PLANS)[number]["name"] | typeof FREE_PLAN;

// Only these unlock a plan. Direct debits (Bacs, SEPA) sit in `incomplete` for about three
// working days until the payment clears.
export const ENTITLED_STATUSES = ["active", "trialing"] as const;

// Stripe subscription statuses after which nothing more is billed. Any other status with a
// Stripe id is a live subscription: a new checkout beside it would bill the organization twice.
export const ENDED_STATUSES = ["canceled", "incomplete_expired"] as const;

// Live but not unlocking the plan: a direct debit still clearing, or a renewal that failed.
export const CLEARING_STATUSES = ["incomplete"] as const;
export const FAILED_STATUSES = ["past_due", "unpaid"] as const;

// Better Auth's invitation status for one not yet accepted, declined, or cancelled.
export const PENDING_INVITATION_STATUS = "pending";

// Seat-limit refusal, so screens can explain it.
export const SEAT_LIMIT_ERROR_CODE = "SEAT_LIMIT_REACHED";

// Currencies prices are shown and charged in; the seed script creates all three.
export const BILLING_CURRENCIES = ["gbp", "eur", "usd"] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

export type PlanPrice = {
  plan: (typeof PLANS)[number]["name"];
  // Minor units per currency; missing when the Stripe price has no amount in that currency.
  monthly: Partial<Record<BillingCurrency, number>>;
  annual: Partial<Record<BillingCurrency, number>>;
};
