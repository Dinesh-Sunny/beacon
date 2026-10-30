import { cookies } from "next/headers";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { AnalyticsEvent } from "./analytics-events";
import { ANALYTICS_CONSENT_COOKIE, hasAnalyticsConsent } from "./consent";
import { posthogHosts } from "./posthog-hosts";

// Same public project key as the browser. Unset: server events are dropped.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let client: PostHog | undefined;

function serverClient(): PostHog | undefined {
  if (!POSTHOG_KEY) return undefined;
  // Serverless instances can freeze between requests, so nothing waits in a batch: each event
  // is sent with captureImmediate after the response.
  client ??= new PostHog(POSTHOG_KEY, {
    host: posthogHosts().api,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

type ServerEvent = {
  // Our user id. Server events never carry email or name.
  distinctId: string;
  event: AnalyticsEvent;
  properties?: Record<string, string | number | boolean>;
};

// Only for visitors who accepted analytics: the browser's choice is mirrored into a cookie
// (consent.ts). Read during the request, because cookies() isn't reliable once the response
// has gone. No cookie, no request scope, or a refusal: nothing is sent.
async function consented(): Promise<boolean> {
  try {
    const store = await cookies();
    return hasAnalyticsConsent(store.get(ANALYTICS_CONSENT_COOKIE)?.value);
  } catch {
    // Outside a request (scripts, tests) there is no visitor and so no consent.
    return false;
  }
}

// after() needs a request scope too; outside one, a plain fire-and-forget instead of an exception
// that would fail the auth call that triggered the event.
function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

// Product events the server is the source of truth for (sign-ups, purchases). Sent after the
// response so a slow PostHog never slows a request; failures are logged, never thrown.
export async function captureServerEvent({
  distinctId,
  event,
  properties,
}: ServerEvent): Promise<void> {
  const posthog = serverClient();
  if (!posthog || !(await consented())) return;
  runAfterResponse(async () => {
    try {
      await posthog.captureImmediate({ distinctId, event, properties });
    } catch (error) {
      console.error("[analytics] server event failed:", event, error);
    }
  });
}
