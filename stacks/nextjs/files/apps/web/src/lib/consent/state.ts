// What the analytics choice is right now, from c15t's stored consent. Pure (no SDKs) so it can be
// tested; components/consent/ConsentManager.tsx applies the result.

export type AnalyticsConsentState = "granted" | "denied" | "undecided";

// The parts of c15t's ConsentInfo this needs. `time` is epoch milliseconds.
export type StoredConsent = {
  time: number;
  requiresReconsent?: boolean;
} | null;

export const MS_PER_DAY = 86_400_000;

export function isConsentExpired(
  consent: StoredConsent,
  now: number,
  expiryDays: number,
): boolean {
  return consent !== null && now - consent.time > expiryDays * MS_PER_DAY;
}

// Undecided covers no choice yet, a policy change that needs a fresh choice, and an expired
// choice: in all three nothing optional may run until the visitor answers the banner again.
export function analyticsConsentState({
  consent,
  measurement,
  now,
  expiryDays,
}: {
  consent: StoredConsent;
  measurement: boolean;
  now: number;
  expiryDays: number;
}): AnalyticsConsentState {
  if (consent === null || consent.requiresReconsent) return "undecided";
  if (isConsentExpired(consent, now, expiryDays)) return "undecided";
  return measurement ? "granted" : "denied";
}

// A save that turned any category off: loaded trackers must be stopped and the page reloaded.
export function isWithdrawal(
  allowedBefore: readonly string[],
  allowedNow: readonly string[],
): boolean {
  return allowedBefore.some((category) => !allowedNow.includes(category));
}
