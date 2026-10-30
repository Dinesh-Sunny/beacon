// Host handling for multi-tenant routing (docs/adr/0002-multi-tenancy.md). Pure (no aliases),
// so next.config.ts and `node --test` import it.

// The internal route segment the request host is rewritten into: /<host>/<path>.
export const SITE_PARAM = "site";

// First path segments that belong to the app, not a tenant's site: their routes are dynamic,
// so the host rewrite (which runs before dynamic routes) must leave them alone. Static app
// routes (sign-in, account, robots.txt) match before the rewrite and need no entry.
export const APP_PATH_PREFIXES = [
  "api",
  "account",
  "og",
  "admin",
  "accept-invitation",
  "md",
  "_next",
  "ingest",
  "monitoring",
] as const;

// Subdomains of this domain name tenants by slug (`acme.example.com` → tenant `acme`). Unset:
// only listed custom domains pick a tenant; every other host is the default site.
export const TENANT_BASE_DOMAIN_ENV = "TENANT_BASE_DOMAIN";

const HOSTNAME =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

// Development hostname that has no dot.
const LOCALHOST = "localhost";

// A request host as the router compares it: lowercase, no port, no trailing dot. Null for
// anything that isn't a plausible hostname (a dotted name, or localhost), so junk in the Host
// header or the internal segment never reaches a query.
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!HOSTNAME.test(host)) return null;
  return host.includes(".") || host === LOCALHOST ? host : null;
}

// The `[site]` segment is only valid in its normalized form: one cache entry per host, and app
// prefixes (`/api`, `/monitoring`, …) that fell through to the segment answer 404.
export function siteParamHost(param: string): string | null {
  const host = normalizeHost(param);
  if (host !== param) return null;
  return (APP_PATH_PREFIXES as readonly string[]).includes(host) ? null : host;
}

// The tenant slug a host names under the base domain, or null.
export function subdomainSlug(
  host: string,
  baseDomain: string | undefined,
): string | null {
  if (!baseDomain) return null;
  const suffix = `.${baseDomain.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return label && !label.includes(".") ? label : null;
}

// Whether a host is under the base domain at all (an unknown subdomain there is a 404, not the
// default site).
export function isUnderBaseDomain(
  host: string,
  baseDomain: string | undefined,
): boolean {
  if (!baseDomain) return false;
  const base = baseDomain.toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}
