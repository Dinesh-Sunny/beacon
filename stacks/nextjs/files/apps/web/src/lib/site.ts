import type { MetadataRoute, Route } from "next";
import { ANALYTICS_INGEST_PATH } from "@/lib/observability/posthog-hosts";
import { SENTRY_TUNNEL_ROUTE } from "@/lib/observability/sentry-tunnel";

// Single source of truth for site identity and SEO. Neutral base values: each client fork
// replaces them; metadata, sitemap, robots, manifest, OG images, and JSON-LD all read from here.
// Page titles and descriptions for CMS pages come from Payload.
export const SITE = {
  name: "__NAME__",
  tagline: "A new site, ready for its first page",
  description:
    "Sign in, manage your account, and read what this site publishes.",
  locale: "en_US",
  language: "en",
  // X/Twitter handle (with @) for twitter:site and twitter:creator; leave empty until one exists.
  twitterHandle: "",
} as const;

const LOCAL_URL = "http://localhost:3000";

// SITE_URL wins; on Vercel fall back to the project's production domain so previews still
// canonicalize to production instead of their throwaway deployment URL.
function configuredSiteUrl(): URL | undefined {
  if (process.env.SITE_URL) return new URL(process.env.SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return undefined;
}

const CONFIGURED_SITE_URL = configuredSiteUrl();

export const SITE_URL = CONFIGURED_SITE_URL ?? new URL(LOCAL_URL);

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export const IS_PRODUCTION =
  process.env.VERCEL_ENV === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.VERCEL_ENV === "production";

// Only production builds with a real origin get indexed. Without one, canonicals and the sitemap
// would point at localhost, so previews, local builds, and unconfigured hosts stay noindex.
export const IS_INDEXABLE = IS_PRODUCTION && CONFIGURED_SITE_URL !== undefined;

type SitemapEntry = MetadataRoute.Sitemap[number];

// Public, indexable code routes. CMS pages are added to the sitemap from Payload.
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  // Site pages live under the internal `[site]` segment, so their public paths are typed by hand.
  { path: "/text-stats" as Route, changeFrequency: "monthly", priority: 0.5 },
] as const satisfies ReadonlyArray<
  { path: Route } & Pick<SitemapEntry, "changeFrequency" | "priority">
>;

// Internal routes crawlers must skip (also marked noindex in their own metadata).
export const PRIVATE_ROUTES = [
  "/design",
] as const satisfies ReadonlyArray<Route>;

// Paths outside the typed site routes that crawlers must skip: the Payload admin (its own root
// layout, also sent with X-Robots-Tag), the REST/GraphQL API and route handlers, and the
// analytics and error-report proxies.
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/api/",
  ANALYTICS_INGEST_PATH,
  SENTRY_TUNNEL_ROUTE,
] as const;
