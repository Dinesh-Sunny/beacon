import { AuthConfigError, resolveAuthOrigins } from "@__NAME__/auth/origins";
import { withPayload } from "@payloadcms/next/withPayload";
import { withSentryConfig } from "@sentry/nextjs/config";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import {
  ANALYTICS_INGEST_PATH,
  posthogHosts,
} from "./src/lib/observability/posthog-hosts";
import { SENTRY_TUNNEL_ROUTE } from "./src/lib/observability/sentry-tunnel";
import {
  HOME_MARKDOWN_PATH,
  INDEX_SEGMENT,
  MARKDOWN_ROUTE,
  MARKDOWN_SUFFIX,
} from "./src/lib/page-path";
import { APP_PATH_PREFIXES, SITE_PARAM } from "./src/lib/site-host";
import { HOME_SLUG } from "./src/payload/constants";

function mediaRemotePatterns(): NextConfig["images"] {
  const base = process.env.MEDIA_PUBLIC_URL;
  if (!base) return undefined;
  return { remotePatterns: [new URL(`${base.replace(/\/$/, "")}/**`)] };
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Opt-in caching via `use cache`; prerenders a static shell and streams dynamic parts (PPR).
  cacheComponents: true,
  // One reusable App Shell prefetch per route instead of one per visible link. Needs cacheComponents.
  partialPrefetching: true,
  // `<Link href>` and router pushes are type-checked against the real route tree.
  typedRoutes: true,
  poweredByHeader: false,
  // PostHog's ingest endpoints end in a slash (/ingest/e/); the default redirect would strip it
  // and drop the event. The redirect below restores it for every other path, so pages still
  // have one URL.
  skipTrailingSlashRedirect: true,
  redirects: async () => [
    ...appHostRedirects(),
    // The CMS home page lives at `/`. A config redirect is a real 308 even on the first request;
    // one from the page would arrive after the streamed 200 shell.
    { source: `/${HOME_SLUG}`, destination: "/", permanent: true },
    {
      source: `/:path((?!${ANALYTICS_INGEST_PATH.slice(1)}/).+)/`,
      destination: "/:path",
      permanent: true,
    },
  ],
  rewrites: async () => ({
    beforeFiles: markdownRewrites.beforeFiles,
    afterFiles: [
      ...analyticsRewrites(),
      ...markdownRewrites.afterFiles,
      ...siteRewrites,
    ],
    fallback: [],
  }),
  // Uploads on a public media domain (R2 custom domain) are optimized by next/image too.
  // Read at build time, like SITE_URL.
  images: mediaRemotePatterns(),
  // Emails render at request time and read their colors from globals.css (lib/theme-colors.ts).
  // The tracer finds that read today; this keeps it if the read ever becomes dynamic. Any route
  // can send an email (auth, Payload).
  outputFileTracingIncludes: { "/*": ["./src/app/globals.css"] },
  experimental: {
    // Native Rust React Compiler inside Turbopack; faster than the Babel plugin.
    turbopackRustReactCompiler: true,
    // Hugeicons is a barrel of thousands of icons and isn't on Next's default optimized list.
    optimizePackageImports: ["@hugeicons/core-free-icons"],
    // The site and the Payload admin are separate root layouts; app/global-not-found.tsx
    // serves unmatched URLs for both.
    globalNotFound: true,
  },
};

// Markdown for agents (lib/agent-markdown.ts): `/<slug>.md`, `/index.md`, or a CMS page asked
// for with `Accept: text/markdown`. The slug rule runs after app routes are matched (afterFiles),
// so sign-in, account, and other app pages keep answering in HTML.
const MARKDOWN_ACCEPT = {
  type: "header",
  key: "accept",
  value: ".*text/markdown.*",
} as const;
const CMS_SLUG = ":slug([a-z0-9-]+)";
const HOME_MARKDOWN_ROUTE = `${MARKDOWN_ROUTE}/${INDEX_SEGMENT}`;

const markdownRewrites = {
  beforeFiles: [
    // To `/md/index`, not `/md`: a rewrite of `/` to the bare catch-all hands it `["md"]`.
    { source: HOME_MARKDOWN_PATH, destination: HOME_MARKDOWN_ROUTE },
    {
      source: `/${CMS_SLUG}${MARKDOWN_SUFFIX}`,
      destination: `${MARKDOWN_ROUTE}/:slug`,
    },
    { source: "/", has: [MARKDOWN_ACCEPT], destination: HOME_MARKDOWN_ROUTE },
  ],
  afterFiles: [
    {
      source: `/${CMS_SLUG}`,
      has: [MARKDOWN_ACCEPT],
      destination: `${MARKDOWN_ROUTE}/:slug`,
    },
  ],
};

// Multi-tenancy (docs/adr/0002-multi-tenancy.md): the request host becomes the internal
// `[site]` segment, so every tenant's pages are cached on their own and the proxy stays tiny.
// Runs after app routes match (afterFiles), and app prefixes with dynamic routes (api, admin,
// accept-invitation, …) are left alone. `/<host>/…` typed directly gains a second host
// segment and 404s.
const SITE_HOST = {
  type: "host",
  value: `(?<${SITE_PARAM}>.+)`,
} as const;
const APP_PREFIX_LOOKAHEAD = `(?!(?:${APP_PATH_PREFIXES.join("|")})(?:/|$))`;

const siteRewrites = [
  { source: "/", has: [SITE_HOST], destination: `/:${SITE_PARAM}` },
  {
    source: `/:path(${APP_PREFIX_LOOKAHEAD}.+)`,
    has: [SITE_HOST],
    destination: `/:${SITE_PARAM}/:path`,
  },
];

// Sign-in, account, and invitations live on the app host only (Better Auth never trusts tenant
// domains). On any other host they redirect there. Hosts come from the same resolver Better
// Auth uses, read at build time; without one configured, nothing redirects. On Vercel production
// without BETTER_AUTH_URL the project's production domain is the app host, so other domains
// serving the default site send sign-in there too.
const APP_HOST_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/two-factor",
  "/account/:path*",
  "/accept-invitation/:path*",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appHostRedirects() {
  let origins: ReturnType<typeof resolveAuthOrigins>;
  try {
    origins = resolveAuthOrigins();
  } catch (error) {
    // Production without BETTER_AUTH_URL (and not on Vercel): auth can't run either, and the
    // app's own startup check says so. Say it here too rather than build without redirects.
    if (!(error instanceof AuthConfigError)) throw error;
    console.warn(
      "[tenancy] no app host configured: sign-in pages won't redirect from tenant domains",
    );
    return [];
  }
  const appHosts = origins.allowedHosts.map((entry) =>
    escapeRegex(entry.replace(/:(\d+|\*)$/, "").toLowerCase()),
  );
  return APP_HOST_PATHS.map((source) => ({
    source,
    missing: [{ type: "host" as const, value: `^(?:${appHosts.join("|")})$` }],
    destination: `${origins.canonical}${source}`,
    permanent: false,
  }));
}

// Same-origin analytics: the browser posts to /ingest and Next forwards to PostHog. Static assets
// and the array config come from the assets host and must be listed before the catch-all.
function analyticsRewrites() {
  const hosts = posthogHosts();
  return [
    {
      source: `${ANALYTICS_INGEST_PATH}/static/:path*`,
      destination: `${hosts.assets}/static/:path*`,
    },
    {
      source: `${ANALYTICS_INGEST_PATH}/array/:path*`,
      destination: `${hosts.assets}/array/:path*`,
    },
    {
      source: `${ANALYTICS_INGEST_PATH}/:path*`,
      destination: `${hosts.api}/:path*`,
    },
  ];
}

// Payload's default admin route (config.routes.admin). Change both together.
const ADMIN_HEADERS_SOURCE = "/admin/:path*";
const PAYLOAD_CLIENT_HINT_HEADERS = new Set([
  "Accept-CH",
  "Vary",
  "Critical-CH",
]);

// withPayload adds color-scheme client hints (including `Vary`) to every path, which would split
// the CDN cache of public pages per color scheme. Only the admin reads them, so scope them there.
function scopeClientHintsToAdmin(config: NextConfig): NextConfig {
  const payloadHeaders = config.headers;
  if (!payloadHeaders) return config;
  return {
    ...config,
    headers: async () =>
      (await payloadHeaders()).map((rule) =>
        rule.source === "/:path*" &&
        rule.headers.some(({ key }) => PAYLOAD_CLIENT_HINT_HEADERS.has(key))
          ? {
              ...rule,
              source: ADMIN_HEADERS_SOURCE,
              // The admin layout isn't the site layout, so it never gets the site's robots meta.
              headers: [
                ...rule.headers,
                { key: "X-Robots-Tag", value: "noindex, nofollow" },
              ],
            }
          : rule,
      ),
  };
}

// Sentry org, project, and auth token come from SENTRY_ORG, SENTRY_PROJECT, and
// SENTRY_AUTH_TOKEN. Without a token the build skips source map upload instead of failing.
export default withSentryConfig(
  scopeClientHintsToAdmin(
    // BotID proxies its challenge script through this domain (rewrites), so blockers don't stop it.
    withPayload(withBotId(nextConfig), { devBundleServerPackages: false }),
  ),
  {
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: true,
    // Browser events go through our own domain, so ad blockers don't drop error reports.
    tunnelRoute: SENTRY_TUNNEL_ROUTE,
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  },
);
