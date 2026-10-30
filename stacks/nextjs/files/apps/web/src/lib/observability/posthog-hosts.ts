// PostHog Cloud hosts per region. Plain module (no aliases) so next.config.ts can import it for
// the /ingest rewrites. EU by default: the business is UK-registered.

export const POSTHOG_REGIONS = ["eu", "us"] as const;
export type PostHogRegion = (typeof POSTHOG_REGIONS)[number];

export const POSTHOG_REGION_ENV = "NEXT_PUBLIC_POSTHOG_REGION";
const DEFAULT_REGION: PostHogRegion = "eu";

// Same-origin path the browser sends events to; next.config.ts rewrites it to PostHog so ad
// blockers don't drop analytics and no third-party request leaves the page.
export const ANALYTICS_INGEST_PATH = "/ingest";

export function posthogRegion(
  value: string | undefined = process.env[POSTHOG_REGION_ENV],
): PostHogRegion {
  return POSTHOG_REGIONS.find((region) => region === value) ?? DEFAULT_REGION;
}

export function posthogHosts(region: PostHogRegion = posthogRegion()) {
  return {
    api: `https://${region}.i.posthog.com`,
    assets: `https://${region}-assets.i.posthog.com`,
    // Links in the PostHog toolbar point at the app, not the ingest host.
    ui: `https://${region}.posthog.com`,
  };
}
