import { CONSENT_EXPIRY_DAYS } from "@/lib/consent/config";
import { MS_PER_DAY } from "@/lib/consent/state";

// The visitor's analytics choice, mirrored into a first-party cookie so the server can honour it
// (server events, later conversions). Present only while analytics is granted; written and removed
// by applyAnalyticsConsent (lib/observability/analytics.ts). Storing the choice is strictly
// necessary. c15t's own cookie is the source of truth; its format is internal.
export const ANALYTICS_CONSENT_COOKIE = "__PYNAME___analytics_consent";

export const CONSENT_GRANTED = "granted";

// The mirror ends when the choice does: the consent time plus the expiry, not "now plus".
export function mirrorExpiry(chosenAt: number): number {
  return chosenAt + CONSENT_EXPIRY_DAYS * MS_PER_DAY;
}

export function hasAnalyticsConsent(cookieValue: string | undefined): boolean {
  return cookieValue === CONSENT_GRANTED;
}
