import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import type { Where } from "payload";
import { authHostnames } from "@/lib/auth-host";
import { getPayloadClient } from "@/lib/payload";
import { IS_INDEXABLE, IS_PRODUCTION, SITE, SITE_URL } from "@/lib/site";
import {
  normalizeHost,
  siteParamHost,
  subdomainSlug,
  TENANT_BASE_DOMAIN_ENV,
} from "@/lib/site-host";
import {
  CACHE_TAGS,
  COLLECTIONS,
  DEFAULT_TENANT_SLUG,
} from "@/payload/constants";
import type { Tenant } from "@/payload-types";

// Which tenant's site a request is for, from its host (docs/adr/0002-multi-tenancy.md): a listed
// custom domain, `<slug>.<TENANT_BASE_DOMAIN>`, or else the default site. Every public read in
// lib/cms.ts takes the tenant id this returns.

export class TenantConfigError extends Error {
  override name = "TenantConfigError";
}

// Hosts statically prerendered per tenant (the rest render on first visit).
const PRERENDER_HOST_LIMIT = 50;

const ACTIVE: Where = { status: { equals: "active" } };

// Tenants are system data (not on behalf of a visitor), read with access control off.
async function findTenant(where: Where): Promise<Tenant | null> {
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: COLLECTIONS.tenants,
    where,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
  });
  return docs[0] ?? null;
}

// The seeded fallback tenant (migration `tenancy`). Missing means the migrations haven't run.
export async function getDefaultTenant(): Promise<Tenant> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tenants);
  const tenant = await findTenant({ slug: { equals: DEFAULT_TENANT_SLUG } });
  if (!tenant) {
    throw new TenantConfigError(
      `No "${DEFAULT_TENANT_SLUG}" tenant: run pnpm db:migrate`,
    );
  }
  return tenant;
}

// The active tenant a host names explicitly (a listed domain or `<slug>.<base domain>`), without
// the default-site fallback. Used where only real tenant hosts may be trusted (consent API).
export async function getListedTenantByHost(
  host: string,
): Promise<Tenant | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tenants);
  const byDomain = await findTenant({
    and: [{ "domains.domain": { equals: host } }, ACTIVE],
  });
  if (byDomain) return byDomain;
  const slug = subdomainSlug(host, process.env[TENANT_BASE_DOMAIN_ENV]);
  return slug
    ? findTenant({ and: [{ slug: { equals: slug } }, ACTIVE] })
    : null;
}

// Hosts the default site answers on: the configured site and the app's own hosts (which include
// this deployment's Vercel URLs, and localhost outside production). Any other unlisted host is a
// 404, so a forged Host header can't create a cached copy of the site per invented host.
function isDefaultSiteHost(host: string): boolean {
  return host === SITE_URL.hostname || authHostnames().includes(host);
}

// The active tenant for a host, or null (unknown host, unknown subdomain under the base domain,
// or a suspended site): those answer 404.
export async function getTenantByHost(host: string): Promise<Tenant | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tenants);
  const listed = await getListedTenantByHost(host);
  if (listed) return listed;
  if (!isDefaultSiteHost(host)) return null;
  const fallback = await getDefaultTenant();
  return fallback.status === "active" ? fallback : null;
}

// Primary hosts to prerender: every active tenant's primary domain plus the configured site.
export async function getPrerenderHosts(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.tenants);
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: COLLECTIONS.tenants,
    where: ACTIVE,
    overrideAccess: true,
    depth: 0,
    limit: PRERENDER_HOST_LIMIT,
    pagination: false,
    // Oldest first, so the prerendered set is the same from build to build.
    sort: "createdAt",
    select: { domains: true },
  });
  const hosts = docs.flatMap(
    (tenant) =>
      tenant.domains
        ?.filter((entry) => entry.primary)
        .map((entry) => entry.domain) ?? [],
  );
  return [...new Set([SITE_URL.hostname, ...hosts])];
}

export type SiteContext = {
  tenant: Tenant;
  host: string;
  // Canonical origin for links, sitemaps, and social cards.
  origin: URL;
  name: string;
  description: string;
  indexable: boolean;
};

function primaryDomain(tenant: Tenant): string | null {
  const domains = tenant.domains ?? [];
  return (domains.find((entry) => entry.primary) ?? domains[0])?.domain ?? null;
}

// Everything a page needs about its site. The default site keeps the base SITE_URL and SITE
// identity; other tenants use their primary domain and identity overrides.
export function siteContext(tenant: Tenant, host: string): SiteContext {
  const isDefault = tenant.slug === DEFAULT_TENANT_SLUG;
  const domain = isDefault ? null : primaryDomain(tenant);
  const origin = domain ? new URL(`https://${domain}`) : SITE_URL;
  return {
    tenant,
    host,
    origin,
    name: tenant.identity?.siteName || (isDefault ? SITE.name : tenant.name),
    description: tenant.identity?.description || SITE.description,
    // Production only, and only with a real canonical origin (previews stay noindex).
    indexable: isDefault ? IS_INDEXABLE : IS_PRODUCTION && domain !== null,
  };
}

// For pages: the site from the `[site]` route segment. Null answers 404.
export async function getSiteForParam(
  param: string,
): Promise<SiteContext | null> {
  const host = siteParamHost(param);
  if (!host) return null;
  const tenant = await getTenantByHost(host);
  return tenant ? siteContext(tenant, host) : null;
}

// For route handlers (sitemap, robots, llms.txt, Markdown): the site from the request host.
export async function getSiteForRequest(): Promise<SiteContext | null> {
  const host = normalizeHost((await headers()).get("host"));
  if (!host) return null;
  const tenant = await getTenantByHost(host);
  return tenant ? siteContext(tenant, host) : null;
}
