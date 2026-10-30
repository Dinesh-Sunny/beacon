// Limits on the public consent API before c15t sees a request. The API is unauthenticated by
// design (anonymous visitors record choices), so it must not let a script grow the database or
// rewrite someone else's consent. Pure so it can be tested; route.ts applies it.

import { CONSENT_API_PATH, CONSENT_EXPIRY_DAYS } from "./config.ts";
import { MS_PER_DAY } from "./state.ts";

// A real consent save is well under 2 KB.
export const MAX_CONSENT_BODY_BYTES = 8 * 1024;

// How far ahead of the server clock a browser's `givenAt` may be (clock drift).
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Looks consent up by account id with no API key. Subjects are linked to accounts server-side
// (lib/privacy/consent-link.ts), so this would expose anyone's consent by user id: keep it blocked.
const BLOCKED_GET_PATHS = [`${CONSENT_API_PATH}/consents/check`] as const;
// Reading a subject returns its linked account id and consent history. The banner never reads
// subjects (c15t only POSTs them), so every subject read is refused.
const BLOCKED_GET_PREFIXES = [`${CONSENT_API_PATH}/subjects`] as const;

const HTTP = {
  methodNotAllowed: 405,
  badRequest: 400,
  notFound: 404,
  tooLarge: 413,
} as const;

// Linking a device's consent to an account (`externalSubjectId`, PATCH /subjects/:id) must come
// from the server with a verified session, never from the browser.
const CLIENT_FORBIDDEN_FIELDS = [
  "externalSubjectId",
  "externalId",
  "identityProvider",
] as const;

function reject(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

// Reads the body but stops at the cap, so a chunked request with no content-length can't make
// the server buffer more than the limit. Null means too large.
async function readCapped(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CONSENT_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// c15t accepts any past `givenAt` and computes validity from it, so a script could store consent
// dated years back. A genuine save is "now", or a retry queued while offline, which is still
// younger than a choice's lifetime.
function isPlausibleGivenAt(givenAt: unknown, now: number): boolean {
  if (givenAt === undefined) return true;
  if (typeof givenAt !== "number") return false;
  return (
    givenAt <= now + MAX_CLOCK_SKEW_MS &&
    givenAt >= now - CONSENT_EXPIRY_DAYS * MS_PER_DAY
  );
}

export async function guardConsentRequest(
  request: Request,
  allowedHostnames: readonly string[],
  now: number = Date.now(),
): Promise<Request | Response> {
  if (
    request.method === "PATCH" ||
    request.method === "PUT" ||
    request.method === "DELETE"
  ) {
    return reject(HTTP.methodNotAllowed, "Not allowed");
  }
  if (request.method !== "POST") {
    const { pathname } = new URL(request.url);
    const blocked =
      (BLOCKED_GET_PATHS as readonly string[]).includes(pathname) ||
      BLOCKED_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    return blocked ? reject(HTTP.notFound, "Not found") : request;
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CONSENT_BODY_BYTES)
    return reject(HTTP.tooLarge, "Request too large");
  const text = await readCapped(request);
  if (text === null) return reject(HTTP.tooLarge, "Request too large");

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return reject(HTTP.badRequest, "Invalid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return reject(HTTP.badRequest, "Invalid body");
  }
  const record = body as Record<string, unknown>;
  if ("domain" in record && !allowedHostnames.includes(String(record.domain))) {
    return reject(HTTP.badRequest, "Unknown domain");
  }
  if (!isPlausibleGivenAt(record.givenAt, now)) {
    return reject(HTTP.badRequest, "Invalid consent time");
  }
  for (const field of CLIENT_FORBIDDEN_FIELDS) delete record[field];

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(record),
  });
}
