import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSENT_EXPIRY_DAYS } from "./config.ts";
import {
  guardConsentRequest,
  MAX_CLOCK_SKEW_MS,
  MAX_CONSENT_BODY_BYTES,
} from "./request-guard.ts";
import { MS_PER_DAY } from "./state.ts";

const URL_ = "http://localhost:3000/api/c15t/subjects";
const HOSTS = ["localhost", "example.com"];

function post(body: unknown): Request {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("should refuse PATCH so a browser can't relink someone else's consent", async () => {
  const result = await guardConsentRequest(
    new Request(`${URL_}/sub_1`, { method: "PATCH", body: "{}" }),
    HOSTS,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 405);
});

test("should refuse a body over the size limit", async () => {
  const result = await guardConsentRequest(
    post({ domain: "localhost", metadata: "x".repeat(MAX_CONSENT_BODY_BYTES) }),
    HOSTS,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 413);
});

test("should refuse a domain that isn't one of ours", async () => {
  const result = await guardConsentRequest(
    post({ domain: "evil.test" }),
    HOSTS,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 400);
});

test("should strip account links and pass the rest through when the body is valid", async () => {
  const result = await guardConsentRequest(
    post({
      domain: "example.com",
      preferences: { measurement: true },
      externalSubjectId: "u1",
    }),
    HOSTS,
  );
  assert.ok(result instanceof Request);
  assert.deepEqual(await result.json(), {
    domain: "example.com",
    preferences: { measurement: true },
  });
});

test("should pass GET requests through untouched", async () => {
  const request = new Request("http://localhost:3000/api/c15t/init");
  assert.equal(await guardConsentRequest(request, HOSTS), request);
});

test("should refuse the unauthenticated consent lookup by account id", async () => {
  const result = await guardConsentRequest(
    new Request(
      "http://localhost:3000/api/c15t/consents/check?externalId=x&type=cookie_banner",
    ),
    HOSTS,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 404);
});

test("should refuse reading a consent subject, which names its linked account", async () => {
  for (const path of [
    "/api/c15t/subjects/sub_abc",
    "/api/c15t/subjects?externalId=x",
  ]) {
    const result = await guardConsentRequest(
      new Request(`http://localhost:3000${path}`),
      HOSTS,
    );
    assert.ok(result instanceof Response, path);
    assert.equal(result.status, 404);
  }
});

test("should refuse an oversized chunked body that declares no length", async () => {
  const chunk = new TextEncoder().encode("x".repeat(1024));
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ > MAX_CONSENT_BODY_BYTES / chunk.byteLength)
        controller.close();
      else controller.enqueue(chunk);
    },
  });
  const result = await guardConsentRequest(
    new Request(URL_, { method: "POST", body, duplex: "half" } as RequestInit),
    HOSTS,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 413);
});

test("should refuse consent backdated past a choice's lifetime", async () => {
  const now = Date.UTC(2026, 9, 3);
  const old = now - (CONSENT_EXPIRY_DAYS + 1) * MS_PER_DAY;
  const result = await guardConsentRequest(
    post({ domain: "localhost", givenAt: old }),
    HOSTS,
    now,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 400);
});

test("should refuse consent dated in the future beyond clock drift", async () => {
  const now = Date.UTC(2026, 9, 3);
  const result = await guardConsentRequest(
    post({ domain: "localhost", givenAt: now + MAX_CLOCK_SKEW_MS + 1 }),
    HOSTS,
    now,
  );
  assert.ok(result instanceof Response);
  assert.equal(result.status, 400);
});

test("should accept a save retried from an offline queue a day later", async () => {
  const now = Date.UTC(2026, 9, 3);
  const result = await guardConsentRequest(
    post({ domain: "localhost", givenAt: now - MS_PER_DAY }),
    HOSTS,
    now,
  );
  assert.ok(result instanceof Request);
});
