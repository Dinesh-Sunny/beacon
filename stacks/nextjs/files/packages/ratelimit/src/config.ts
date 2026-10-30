// Single source of truth for rate-limit settings shared by the consent API, Better Auth, and tests.

// Upstash REST credentials. The Vercel Marketplace integration sets the KV_* names; local dev and
// CI use the UPSTASH_* names against a Serverless Redis HTTP container (compose.yaml).
// @upstash/redis reads either pair.
export const RATELIMIT_ENV = {
  url: ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"],
  token: ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"],
} as const;

// Namespace for every limiter key, so the store can be shared with other features later.
export const RATELIMIT_PREFIX = "__NAME__:ratelimit";

// A slow Redis lets requests through after this long: an outage must not take sign-in down too.
export const RATELIMIT_TIMEOUT_MS = 1000;
