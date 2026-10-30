// URLs in auth emails carry single-use secrets (sign-in, reset, verification, invitation). Error
// and analytics events record URLs, so every event passes through here before it leaves.
// Mirrored in python/core/src/__PYNAME___core/observability.py; keep the lists in step.

export const FILTERED = "[Filtered]";

// Query parameters whose values are secrets. Matched case-insensitively.
export const SECRET_QUERY_PARAMS = [
  "token",
  "code",
  "otp",
  "secret",
  "password",
  "key",
  "api_key",
  "signature",
] as const;

// Paths whose next segment is a secret: Better Auth's reset link, Payload's editor reset link,
// invitation ids, and consent subject ids (a subject id is linked to an account).
export const SECRET_PATH_PREFIXES = [
  "/api/auth/reset-password/",
  "/admin/reset/",
  "/accept-invitation/",
  "/api/c15t/subjects/",
] as const;

const SECRET_PARAMS = new Set<string>(SECRET_QUERY_PARAMS);
// Base for parsing relative URLs; only the path and query are returned for them.
const RELATIVE_BASE = "http://relative.invalid";

export function scrubUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value, RELATIVE_BASE);
  } catch {
    return value;
  }
  for (const prefix of SECRET_PATH_PREFIXES) {
    const at = url.pathname.indexOf(prefix);
    if (at === -1) continue;
    const rest = url.pathname.slice(at + prefix.length);
    const slash = rest.indexOf("/");
    url.pathname = `${url.pathname.slice(0, at + prefix.length)}${FILTERED}${slash === -1 ? "" : rest.slice(slash)}`;
  }
  for (const name of [...url.searchParams.keys()]) {
    if (SECRET_PARAMS.has(name.toLowerCase()))
      url.searchParams.set(name, FILTERED);
  }
  const scrubbed = url
    .toString()
    .replaceAll(encodeURIComponent(FILTERED), FILTERED);
  return url.origin === RELATIVE_BASE && !value.startsWith(RELATIVE_BASE)
    ? scrubbed.slice(RELATIVE_BASE.length)
    : scrubbed;
}

// Query strings arrive on their own in some event fields (`request.query_string`).
export function scrubQueryString(query: string): string {
  const leading = query.startsWith("?") ? "?" : "";
  const scrubbed = scrubUrl(`/${leading ? query : `?${query}`}`).slice(2);
  return `${leading}${scrubbed}`;
}
