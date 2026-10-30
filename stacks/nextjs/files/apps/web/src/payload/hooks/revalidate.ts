import { revalidateTag } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from "payload";
import type { Page } from "@/payload-types";
import { CACHE_TAGS, COLLECTIONS } from "../constants";
import { tenantIdOf } from "./tenant-id";

const PUBLISHED_SLUG_CONTEXT_KEY = "publishedSlugBeforeChange";
const PUBLISHED_TENANT_CONTEXT_KEY = "publishedTenantBeforeChange";

// Scripts and migrations run outside a Next.js request, where revalidateTag throws; they pass
// `context: { disableRevalidate: true }`. Publishing uses 'max' (serve the cached copy once more
// while it refreshes in the background). Removing a page (unpublish, rename away, delete) expires
// at once, so taken-down content never reaches another visitor. updateTag is Server Actions only.
// Every tag carries the document's tenant: one site's changes never refresh another's.
const REFRESH = "max";
const EXPIRE_NOW = { expire: 0 };

export function revalidatePagesList(tenantId: string, removed: boolean): void {
  revalidateTag(CACHE_TAGS.pages(tenantId), removed ? EXPIRE_NOW : REFRESH);
}

function revalidatePageTags(
  tenantId: string,
  {
    removed,
    published,
  }: { removed?: string | null; published?: string | null },
): void {
  revalidatePagesList(tenantId, Boolean(removed));
  if (removed) revalidateTag(CACHE_TAGS.page(tenantId, removed), EXPIRE_NOW);
  if (published) {
    revalidateTag(CACHE_TAGS.page(tenantId, published), REFRESH);
  }
}

// `previousDoc` in afterChange is the latest version, often an autosaved draft, not what
// visitors see. Record the live (published) slug before the change so unpublishing or renaming
// still clears the URL that is actually cached.
export const rememberPublishedSlug: CollectionBeforeChangeHook<Page> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== "update" || !originalDoc || req.context.disableRevalidate) {
    return data;
  }
  const live = await req.payload.findByID({
    collection: COLLECTIONS.pages,
    id: originalDoc.id,
    draft: false,
    depth: 0,
    select: { slug: true, _status: true, tenant: true },
    req,
  });
  const published = live?._status === "published";
  req.context[PUBLISHED_SLUG_CONTEXT_KEY] = published ? live.slug : null;
  // An admin can move a page to another tenant: the old site's cached copy must go too.
  req.context[PUBLISHED_TENANT_CONTEXT_KEY] = published
    ? tenantIdOf(live)
    : null;
  return data;
};

export const revalidatePageOnChange: CollectionAfterChangeHook<Page> = ({
  doc,
  req,
}) => {
  // Autosaves only touch drafts, which are never cached for visitors.
  if (
    req.context.disableRevalidate ||
    req.searchParams?.get("autosave") === "true"
  ) {
    return doc;
  }
  const tenantId = tenantIdOf(doc);
  const publishedBefore = req.context[PUBLISHED_SLUG_CONTEXT_KEY] as
    | string
    | null
    | undefined;
  const tenantBefore = req.context[PUBLISHED_TENANT_CONTEXT_KEY] as
    | string
    | null
    | undefined;
  const publishedNow = doc._status === "published" ? doc.slug : null;
  if (tenantBefore && tenantBefore !== tenantId) {
    // Moved to another tenant: the page is gone from the old site, new on the current one.
    revalidatePageTags(tenantBefore, { removed: publishedBefore });
    if (tenantId) revalidatePageTags(tenantId, { published: publishedNow });
  } else if (tenantId && (publishedBefore || publishedNow)) {
    revalidatePageTags(tenantId, {
      removed: publishedBefore !== publishedNow ? publishedBefore : null,
      published: publishedNow,
    });
  }
  return doc;
};

export const revalidatePageOnDelete: CollectionAfterDeleteHook<Page> = ({
  doc,
  req: { context },
}) => {
  const tenantId = tenantIdOf(doc);
  if (!context.disableRevalidate && tenantId) {
    revalidatePageTags(tenantId, { removed: doc?.slug });
  }
  return doc;
};

// Pages embed media (hero images, at depth 1) in their cached copy, so a changed or deleted
// upload refreshes its tenant's pages. A deleted file expires at once: the cached copy would
// point at it.
export const revalidatePagesOnMediaChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req: { context },
}) => {
  if (context.disableRevalidate) return doc;
  const tenantId = tenantIdOf(doc);
  const tenantBefore = tenantIdOf(previousDoc);
  // Moved to another tenant: pages of the old site may still point at it.
  if (tenantBefore && tenantBefore !== tenantId) {
    revalidatePagesList(tenantBefore, true);
  }
  if (tenantId) revalidatePagesList(tenantId, false);
  return doc;
};

export const revalidatePagesOnMediaDelete: CollectionAfterDeleteHook = ({
  doc,
  req: { context },
}) => {
  const tenantId = tenantIdOf(doc);
  if (!context.disableRevalidate && tenantId) {
    revalidatePagesList(tenantId, true);
  }
  return doc;
};

export const revalidateNavigation: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req: { context },
}) => {
  if (context.disableRevalidate) return doc;
  for (const tenantId of new Set([tenantIdOf(doc), tenantIdOf(previousDoc)])) {
    if (tenantId) revalidateTag(CACHE_TAGS.navigation(tenantId), REFRESH);
  }
  return doc;
};

// Host lookups and site identity read tenants; a suspended site or a moved domain must stop
// answering at once.
export const revalidateTenants: CollectionAfterChangeHook = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) revalidateTag(CACHE_TAGS.tenants, EXPIRE_NOW);
  return doc;
};
