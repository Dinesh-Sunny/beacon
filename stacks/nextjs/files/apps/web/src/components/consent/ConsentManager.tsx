"use client";

import {
  ConsentBanner,
  ConsentDialog,
  ConsentManagerProvider,
  useConsentManager,
} from "@c15t/nextjs";
import { gtag } from "@c15t/scripts/google-tag";
import { type ReactNode, useEffect } from "react";
import {
  ANALYTICS_CATEGORY,
  CONSENT_API_PATH,
  CONSENT_CATEGORIES,
  CONSENT_EXPIRY_DAYS,
} from "@/lib/consent/config";
import {
  analyticsConsentState,
  isConsentExpired,
  isWithdrawal,
} from "@/lib/consent/state";
import { CONSENT_THEME } from "@/lib/consent/theme";
import {
  applyAnalyticsConsent,
  withdrawTrackers,
} from "@/lib/observability/analytics";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// GA4 loads only after measurement consent (ADR 0001: tags after consent, no GTM). c15t's helper
// would load it early in Consent Mode "denied"; alwaysLoad off keeps it out until the choice.
const SCRIPTS = GA_MEASUREMENT_ID
  ? [
      gtag({
        id: GA_MEASUREMENT_ID,
        category: ANALYTICS_CATEGORY,
        script: { alwaysLoad: false },
      }),
    ]
  : [];

// Keeps PostHog and the server-side mirror in step with c15t on every load and change: undecided
// (no choice, policy changed, or expired) and denied mean nothing runs; granted starts PostHog.
function AnalyticsConsentBridge() {
  const { consentInfo, consents, resetConsents, setActiveUI } =
    useConsentManager();
  const measurement = Boolean(consents[ANALYTICS_CATEGORY]);
  const chosenAt = consentInfo?.time;
  const requiresReconsent = Boolean(consentInfo?.requiresReconsent);

  useEffect(() => {
    const stored =
      chosenAt === undefined ? null : { time: chosenAt, requiresReconsent };
    const now = Date.now();
    // c15t doesn't age choices out itself. Its script loader may already have started GA4 from
    // the expired choice, so a granted one is withdrawn and the page reloaded clean; otherwise
    // clearing it and showing the banner is enough.
    if (
      !requiresReconsent &&
      isConsentExpired(stored, now, CONSENT_EXPIRY_DAYS)
    ) {
      if (measurement) {
        void withdrawTrackers().then(() => {
          resetConsents();
          window.location.reload();
        });
        return;
      }
      resetConsents();
      setActiveUI("banner", { force: true });
      return;
    }
    const state = analyticsConsentState({
      consent: stored,
      measurement,
      now,
      expiryDays: CONSENT_EXPIRY_DAYS,
    });
    void applyAnalyticsConsent(state, chosenAt);
  }, [chosenAt, requiresReconsent, measurement, resetConsents, setActiveUI]);

  return null;
}

// Turning a category off: stop and clear the trackers first, then reload so scripts that already
// ran are gone. c15t's own reload doesn't wait for async cleanup, so it's off. Any category turning
// off clears every tracker, measurement included: the reload brings back only what's still
// granted, under a fresh id, which is the conservative reading of a withdrawal.
async function onConsentChanged({
  previousAllowedCategories,
  allowedCategories,
}: {
  previousAllowedCategories: readonly string[];
  allowedCategories: readonly string[];
}): Promise<void> {
  if (!isWithdrawal(previousAllowedCategories, allowedCategories)) return;
  await withdrawTrackers();
  window.location.reload();
}

// Consent banner, preferences dialog, and consent-gated scripts for the site (not the Payload
// admin). Choices are stored by our own backend at /api/c15t (lib/consent/backend.ts).
export function ConsentManager({ children }: { children: ReactNode }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "hosted",
        backendURL: CONSENT_API_PATH,
        consentCategories: [...CONSENT_CATEGORIES],
        theme: CONSENT_THEME,
        scripts: SCRIPTS,
        store: { reloadOnConsentRevoked: false },
        // c15t's own cookie lasts as long as the choice does (default would be 365 days).
        storageConfig: { defaultExpiryDays: CONSENT_EXPIRY_DAYS },
        callbacks: {
          onConsentChanged: (payload) => {
            void onConsentChanged(payload);
          },
        },
      }}
    >
      <AnalyticsConsentBridge />
      <ConsentBanner />
      <ConsentDialog />
      {children}
    </ConsentManagerProvider>
  );
}
