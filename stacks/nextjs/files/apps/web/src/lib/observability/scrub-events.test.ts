import assert from "node:assert/strict";
import { test } from "node:test";
import { FILTERED } from "./scrub.ts";
import {
  scrubCaptureFields,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "./scrub-events.ts";

const RESET = "/api/auth/reset-password/live-token?callbackURL=%2Freset";
const SCRUBBED_RESET = `/api/auth/reset-password/${FILTERED}?callbackURL=%2Freset`;

test("should scrub span attributes and descriptions when a transaction records a reset link", () => {
  const event = scrubSentryEvent({
    transaction: `GET ${RESET}`,
    contexts: {
      trace: {
        data: {
          "http.target": RESET,
          "url.path": "/accept-invitation/inv-1",
          "url.query": "token=abc",
          "http.route": "/api/auth/[...all]",
        },
      },
    },
    spans: [
      {
        description: `GET https://example.com${RESET}`,
        data: { "url.full": `https://example.com${RESET}` },
      },
    ],
  });
  const trace = event.contexts?.trace?.data as Record<string, string>;
  assert.equal(trace["http.target"], SCRUBBED_RESET);
  assert.equal(trace["url.path"], `/accept-invitation/${FILTERED}`);
  assert.equal(trace["url.query"], `token=${FILTERED}`);
  assert.equal(trace["http.route"], "/api/auth/[...all]");
  assert.equal(event.transaction, `GET ${SCRUBBED_RESET}`);
  assert.equal(
    event.spans?.[0]?.description,
    `GET https://example.com${SCRUBBED_RESET}`,
  );
  assert.equal(
    (event.spans?.[0]?.data as Record<string, string> | undefined)?.[
      "url.full"
    ],
    `https://example.com${SCRUBBED_RESET}`,
  );
});

test("should scrub the request URL and breadcrumbs when an error event has them", () => {
  const event = scrubSentryEvent({
    request: { url: "https://example.com/x?code=1", query_string: "code=1" },
    breadcrumbs: [{ data: { from: "/sign-in", to: "/x?otp=2" } }],
  });
  assert.equal(event.request?.url, `https://example.com/x?code=${FILTERED}`);
  assert.equal(event.request?.query_string, `code=${FILTERED}`);
  assert.deepEqual(event.breadcrumbs?.[0]?.data, {
    from: "/sign-in",
    to: `/x?otp=${FILTERED}`,
  });
  assert.deepEqual(scrubSentryBreadcrumb({ data: { url: "/y?key=1" } }).data, {
    url: `/y?key=${FILTERED}`,
  });
});

test("should scrub session-entry and person properties when PostHog captures an event", () => {
  const capture = scrubCaptureFields({
    properties: {
      $current_url: "https://example.com/verify?token=a",
      $session_entry_url: `https://example.com${RESET}`,
      $session_entry_pathname: "/accept-invitation/inv-2",
      $set_once: { $initial_current_url: "https://example.com/x?token=b" },
      plan: "pro",
    },
    $set_once: { $initial_pathname: "/admin/reset/t" },
  });
  const properties = capture.properties as Record<string, unknown>;
  assert.equal(
    properties.$current_url,
    `https://example.com/verify?token=${FILTERED}`,
  );
  assert.equal(
    properties.$session_entry_url,
    `https://example.com${SCRUBBED_RESET}`,
  );
  assert.equal(
    properties.$session_entry_pathname,
    `/accept-invitation/${FILTERED}`,
  );
  assert.equal(properties.plan, "pro");
  assert.deepEqual(properties.$set_once, {
    $initial_current_url: `https://example.com/x?token=${FILTERED}`,
  });
  assert.deepEqual(capture.$set_once, {
    $initial_pathname: `/admin/reset/${FILTERED}`,
  });
});
