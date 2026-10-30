import type { init } from "@sentry/nextjs";
import { SECRET_QUERY_PARAMS } from "./scrub";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "./scrub-events";

// Request headers worth keeping on an error: enough to reproduce, nothing that identifies.
const SAFE_HEADERS = ["user-agent", "accept-language", "content-type"] as const;

// Public by design (a DSN only allows sending events), so one variable serves the browser,
// Node, and edge runtimes. Unset: Sentry stays off.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// A tenth of production requests traced is enough to see slow routes without paying for every
// request; every request locally.
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;
const DEVELOPMENT_TRACES_SAMPLE_RATE = 1;

// Shared by every runtime's Sentry.init.
export const SENTRY_OPTIONS = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  // Vercel exposes its environment to the browser as NEXT_PUBLIC_VERCEL_ENV.
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: IS_PRODUCTION
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : DEVELOPMENT_TRACES_SAMPLE_RATE,
  // Sentry 11 collects everything by default. Keep personal data out (UK GDPR): no cookies or
  // bodies, a short header allowlist (no Referer: it can carry tokens), no bound DB values, and
  // users identified by id only (identifyUser sets it).
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: [...SAFE_HEADERS] }, response: false },
    httpBodies: [],
    urlQueryParams: { deny: [...SECRET_QUERY_PARAMS] },
    databaseQueryData: false,
    // Payload serves GraphQL; operation documents and variables can hold user data.
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  // Transactions carry URLs in span attributes (`http.target`, `url.full`, `url.path`) as well
  // as the request; scrubSentryEvent covers all of them.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
} satisfies Parameters<typeof init>[0];
