import { cacheLife, cacheTag } from "next/cache";
import { getPayloadClient } from "@/lib/payload";
import { CACHE_TAGS, COLLECTIONS } from "@/payload/constants";
import type { Navigation, Page } from "@/payload-types";

// Published CMS content for one tenant's site. Every read asks Payload for published documents
// with access control on (`overrideAccess: false`, no user), so a draft can never reach a cached
// page, and filters by tenant itself: the multi-tenant plugin only scopes staff, not anonymous
// reads (docs/adr/0002-multi-tenancy.md). Hooks revalidate the tenant's tags on publish,
// unpublish, rename, and navigation saves; the `max` profile keeps entries until then.

// Depth 1 populates hero media; deeper relations aren't rendered.
const PAGE_DEPTH = 1;
// generateStaticParams prerenders the most recently updated pages; the rest render on first visit.
const PRERENDER_LIMIT = 100;

export async function getPublishedPage(
  tenantId: string,
  slug: string,
): Promise<Page | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages(tenantId), CACHE_TAGS.page(tenantId, slug));
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: COLLECTIONS.pages,
    where: {
      and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }],
    },
    draft: false,
    overrideAccess: false,
    depth: PAGE_DEPTH,
    limit: 1,
    pagination: false,
  });
  return docs[0] ?? null;
}

// Slugs of a tenant's published pages, newest first. Without a limit it reads all of them (the
// sitemap).
export async function getPublishedSlugs(
  tenantId: string,
  limit: number | undefined = undefined,
): Promise<string[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages(tenantId));
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: COLLECTIONS.pages,
    where: { tenant: { equals: tenantId } },
    draft: false,
    overrideAccess: false,
    depth: 0,
    ...(limit === undefined ? { pagination: false } : { limit }),
    select: { slug: true },
    sort: "-updatedAt",
  });
  return docs.map((doc) => doc.slug);
}

export function getPrerenderSlugs(tenantId: string): Promise<string[]> {
  return getPublishedSlugs(tenantId, PRERENDER_LIMIT);
}

// The tenant's header and footer links; empty until an editor saves them.
export async function getNavigation(
  tenantId: string,
): Promise<Pick<Navigation, "header" | "footer">> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.navigation(tenantId));
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: COLLECTIONS.navigation,
    where: { tenant: { equals: tenantId } },
    overrideAccess: false,
    depth: 0,
    limit: 1,
    pagination: false,
  });
  return docs[0] ?? { header: [], footer: [] };
}

export { pagePath } from "@/lib/page-path";
