// Single source of truth for privacy (UK GDPR) settings: data export, erasure, consent linking.

// c15t subject ids: `sub_` + base58 (8 time bytes, 12 random). Anything else is ignored.
export const CONSENT_SUBJECT_ID_PATTERN = /^sub_[1-9A-HJ-NP-Za-km-z]{10,64}$/;

// Written on linked consent subjects so they're recognisable as ours (c15t's `identityProvider`).
export const CONSENT_IDENTITY_PROVIDER = "__NAME__";

// PostHog deletion needs a personal API key with `person:write` on the project (docs/knowledge/
// compliance.md). Unset: account deletion skips PostHog and logs it.
export const POSTHOG_ERASE_ENV = {
  personalApiKey: "POSTHOG_PERSONAL_API_KEY",
  projectId: "POSTHOG_PROJECT_ID",
} as const;

// The download route (app/api/account/export/route.ts).
export const DATA_EXPORT_PATH = "/api/account/export";

// Downloads per person per window (@__NAME__/ratelimit). Building one reads every table we hold.
export const EXPORT_RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 } as const;
export const EXPORT_RATE_LIMIT_SCOPE = "data-export";

// Rows per section of an export; a section that hits its cap is marked `truncated`.
export const EXPORT_ROW_LIMIT = 1000;
// Conversations whose messages are fetched from the sidecar (newest first).
export const EXPORT_MESSAGE_THREAD_LIMIT = 100;
// An export needs a sign-in this recent (Better Auth's default fresh age), read without the
// cookie cache, so a stolen or just-revoked session can't download everything.
export const EXPORT_FRESH_SESSION_MS = 24 * 60 * 60 * 1000;
