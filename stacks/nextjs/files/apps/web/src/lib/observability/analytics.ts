import * as Sentry from "@sentry/nextjs";
import posthog, { type CaptureResult } from "posthog-js";
import type { AnalyticsConsentState } from "@/lib/consent/state";
import { AI_REFERRER_PROPERTY, aiReferrer } from "./ai-referrer";
import {
  ANALYTICS_CONSENT_COOKIE,
  CONSENT_GRANTED,
  mirrorExpiry,
} from "./consent";
import { cookieDomains } from "./cookie-domains";
import { ANALYTICS_INGEST_PATH, posthogHosts } from "./posthog-hosts";
import { SECRET_QUERY_PARAMS } from "./scrub";
import { scrubCaptureFields } from "./scrub-events";

// Public project key. Unset: analytics stays off.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Pinned PostHog behaviour defaults; bump deliberately after reading their changelog.
const POSTHOG_DEFAULTS = "2026-08-30";

// Cookies trackers leave behind (PostHog `ph_*`, GA4 `_ga`, `_ga_<id>`), cleared on withdrawal.
// GA4 is configured to persist its cookies after revocation, so we remove them ourselves.
const TRACKER_COOKIE = /^(ph_|_ga$|_ga_)/;

// PostHog's identity in localStorage (`ph_<token>_posthog`). Its opt-out flag
// (`__ph_opt_in_out_<token>`) doesn't match, so a withdrawal stays recorded.
const TRACKER_STORAGE_KEY = /^ph_/;

// The signed-in user, kept so PostHog can be identified when it starts after the account
// screens mounted (the visitor accepts measurement from the user menu).
let signedInUserId: string | undefined;

function scrubCapture(capture: CaptureResult | null): CaptureResult | null {
  return capture && scrubCaptureFields(capture);
}

function loaded(): boolean {
  return typeof window !== "undefined" && posthog.__loaded;
}

// PostHog starts only after the visitor accepts measurement, so a rejection or an unanswered
// banner means no PostHog code runs, no cookies, and no requests.
function startPostHog(): void {
  if (!POSTHOG_KEY || loaded()) return;
  posthog.init(POSTHOG_KEY, {
    api_host: ANALYTICS_INGEST_PATH,
    ui_host: posthogHosts().ui,
    defaults: POSTHOG_DEFAULTS,
    person_profiles: "identified_only",
    // Sentry owns error tracking; replays wait for their own consent decision.
    capture_exceptions: false,
    disable_session_recording: true,
    // Feature flags live in the Flags SDK + Payload (ADR 0001), so PostHog's flag and remote-config
    // calls are off and behaviour is set here in code.
    advanced_disable_flags: true,
    // Two layers: PostHog masks secret query params in the URLs it records (current, initial,
    // session entry), and scrubCapture also removes path secrets (reset and invitation links).
    mask_personal_data_properties: true,
    custom_personal_data_properties: [...SECRET_QUERY_PARAMS],
    before_send: scrubCapture,
  });
  // Visits that came from an AI assistant carry its name on every event of the session. Set
  // before opting back in below, which captures the landing pageview straight away.
  const source = aiReferrer(document.referrer);
  if (source) posthog.register_for_session({ [AI_REFERRER_PROPERTY]: source });
  // A past withdrawal left PostHog's opt-out flag set; accepting again must lift it.
  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing({ captureEventName: false });
  }
  if (signedInUserId) posthog.identify(signedInUserId);
}

// cookieStore needs a secure context (https or localhost); elsewhere the mirror is skipped and
// server events stay off, which is the safe direction.
async function writeMirror(chosenAt: number): Promise<void> {
  if (typeof cookieStore === "undefined") return;
  await cookieStore.set({
    name: ANALYTICS_CONSENT_COOKIE,
    value: CONSENT_GRANTED,
    path: "/",
    expires: mirrorExpiry(chosenAt),
    sameSite: "lax",
  });
}

// Deletes each matching cookie host-only and on every parent domain, since that's where trackers
// set theirs in production. allSettled: a domain that can't hold cookies may reject, and the
// remaining deletes must still run.
async function deleteCookies(match: (name: string) => boolean): Promise<void> {
  if (typeof cookieStore === "undefined") return;
  const cookies = await cookieStore.getAll();
  const domains = cookieDomains(location.hostname);
  await Promise.allSettled(
    cookies.flatMap(({ name }) =>
      name && match(name)
        ? [
            cookieStore.delete(name),
            ...domains.map((domain) => cookieStore.delete({ name, domain })),
          ]
        : [],
    ),
  );
}

function deleteStorage(match: (key: string) => boolean): void {
  if (typeof localStorage === "undefined") return;
  for (const key of Object.keys(localStorage)) {
    if (match(key)) localStorage.removeItem(key);
  }
}

// Applies the current consent state (lib/consent/state.ts) on every page load and change.
export async function applyAnalyticsConsent(
  state: AnalyticsConsentState,
  chosenAt: number | undefined,
): Promise<void> {
  if (state === "granted" && chosenAt !== undefined) {
    startPostHog();
    await writeMirror(chosenAt);
    return;
  }
  await deleteCookies((name) => name === ANALYTICS_CONSENT_COOKIE);
}

// Called before the page reloads after the visitor turns a category off: stop PostHog, then clear
// what it and GA4 stored, so the reloaded page starts clean. Order matters: reset() also clears
// PostHog's opt-out flag, so it runs first; opting out last keeps the unload `$pageleave` from
// being sent, and disabling persistence stops PostHog writing a fresh id back before the reload.
export async function withdrawTrackers(): Promise<void> {
  if (loaded()) {
    posthog.reset();
    posthog.opt_out_capturing();
    posthog.set_config({ disable_persistence: true });
  }
  deleteStorage((key) => TRACKER_STORAGE_KEY.test(key));
  await deleteCookies(
    (name) => name === ANALYTICS_CONSENT_COOKIE || TRACKER_COOKIE.test(name),
  );
}

// Signed-in user, by id only (no email or name leaves the app).
export function identifyUser(userId: string): void {
  signedInUserId = userId;
  Sentry.setUser({ id: userId });
  if (loaded()) posthog.identify(userId);
}

// On sign-out, so the next person on this browser isn't merged into the last one.
export function resetIdentity(): void {
  signedInUserId = undefined;
  Sentry.setUser(null);
  if (loaded()) posthog.reset();
}
