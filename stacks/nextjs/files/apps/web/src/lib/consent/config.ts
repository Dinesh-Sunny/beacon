// Single source of truth for consent settings shared by the backend, the banner, and docs.

// Same-origin consent API (c15t backend). The static segment wins over Payload's /api/[...slug].
export const CONSENT_API_PATH = "/api/c15t";

// Categories the banner offers. `necessary` is always on; `measurement` covers PostHog and GA4,
// `marketing` covers ad pixels (none ship by default). Add `experience` or `functionality`
// only when something on the site needs them.
export const CONSENT_CATEGORIES = [
  "necessary",
  "measurement",
  "marketing",
] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

// The category PostHog, GA4, and server events follow.
export const ANALYTICS_CATEGORY: ConsentCategory = "measurement";

// How long a choice lasts before the banner asks again (about six months, in line with ICO
// guidance). The backend policy and the server-side mirror cookie both use it.
export const CONSENT_EXPIRY_DAYS = 182;

// Per-IP request limits on the public consent API (@__NAME__/ratelimit). A visitor saves a choice
// once or twice, and every page load calls init once. Reads are generous because whole offices
// and mobile carriers share one IP; saves are what fill the consent tables, so they are tighter.
export const CONSENT_RATE_LIMITS = {
  save: { max: 30, windowSeconds: 60 },
  read: { max: 600, windowSeconds: 60 },
} as const;

// Vercel sets this from the connection; clients can't spoof it there. Same header the consent
// backend records (backend.ts).
export const CLIENT_IP_HEADER = "x-real-ip";

// Consent records are kept this long after a choice ends, as proof for complaints, then deleted
// by the daily consent-retention job.
export const CONSENT_RETENTION_YEARS = 2;
