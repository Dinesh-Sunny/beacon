// Applies scrub.ts to whole Sentry events and PostHog captures. Typed structurally (no SDK
// imports) so `node --test` can run it; sentry-options.ts and analytics.ts pass real events in.
import { scrubQueryString, scrubUrl } from "./scrub.ts";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null;
}

// Attribute keys that can hold a URL, a path, or a query: Next's `http.target`, OpenTelemetry's
// `url.full` / `url.path` / `url.query`, `http.url`, breadcrumb `from` / `to`, PostHog's
// `$current_url`, `$session_entry_pathname`, `$referrer`.
const QUERY_KEY = /(^|[._])query$/i;
const URL_KEY = /(url|full|target|path|pathname|referrer|from|to)$/i;

function scrubValue(key: string, value: string): string {
  if (QUERY_KEY.test(key)) return scrubQueryString(value);
  if (URL_KEY.test(key)) return scrubUrl(value);
  return value;
}

// Scrubs URL-like string values of one flat record in place.
export function scrubUrlFields(record: unknown): void {
  if (!isRecord(record)) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") record[key] = scrubValue(key, value);
  }
}

// Span descriptions and transaction names look like "GET /api/auth/reset-password/<token>".
export function scrubText(text: string): string {
  return text
    .split(" ")
    .map((part) =>
      part.startsWith("/") || /^https?:\/\//.test(part) ? scrubUrl(part) : part,
    )
    .join(" ");
}

type SentryLikeEvent = {
  transaction?: string;
  request?: { url?: string; query_string?: unknown };
  contexts?: { trace?: { data?: unknown } } & AnyRecord;
  spans?: Array<{ data?: unknown; description?: string }>;
  breadcrumbs?: Array<{ data?: unknown }>;
};

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (typeof event.request?.query_string === "string") {
    event.request.query_string = scrubQueryString(event.request.query_string);
  }
  if (event.transaction) event.transaction = scrubText(event.transaction);
  scrubUrlFields(event.contexts?.trace?.data);
  for (const span of event.spans ?? []) {
    scrubUrlFields(span.data);
    if (span.description) span.description = scrubText(span.description);
  }
  for (const crumb of event.breadcrumbs ?? []) scrubUrlFields(crumb.data);
  return event;
}

export function scrubSentryBreadcrumb<T extends { data?: unknown }>(
  crumb: T,
): T {
  scrubUrlFields(crumb.data);
  return crumb;
}

type CaptureLike = {
  properties?: unknown;
  $set?: unknown;
  $set_once?: unknown;
};

// PostHog puts URLs in event properties and in the person updates ($set, $set_once).
export function scrubCaptureFields<T extends CaptureLike>(capture: T): T {
  scrubUrlFields(capture.properties);
  scrubUrlFields(capture.$set);
  scrubUrlFields(capture.$set_once);
  if (isRecord(capture.properties)) {
    scrubUrlFields(capture.properties.$set);
    scrubUrlFields(capture.properties.$set_once);
  }
  return capture;
}
