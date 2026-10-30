import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CmsPage, cmsPageMetadata } from "@/components/site/CmsPage";
import { CmsPageSkeleton } from "@/components/site/CmsPageSkeleton";
import { getPrerenderSlugs, getPublishedPage } from "@/lib/cms";
import { getSiteForParam } from "@/lib/tenant";
import { HOME_SLUG } from "@/payload/constants";

// Cache Components rejects an empty list, so a site with no pages yet prerenders one
// placeholder that 404s. Pages published later render on first visit, then stay cached.
const NO_PAGES_PLACEHOLDER = "__no-pages__";

export async function generateStaticParams({
  params,
}: {
  params: { site: string };
}): Promise<Array<{ slug: string }>> {
  const site = await getSiteForParam(params.site);
  const slugs = site
    ? (await getPrerenderSlugs(site.tenant.id)).filter(
        (slug) => slug !== HOME_SLUG,
      )
    : [];
  return (slugs.length > 0 ? slugs : [NO_PAGES_PLACEHOLDER]).map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[site]/[slug]">): Promise<Metadata> {
  const { site: param, slug } = await params;
  const site = await getSiteForParam(param);
  const page = site ? await getPublishedPage(site.tenant.id, slug) : null;
  return page ? cmsPageMetadata(page) : {};
}

async function SitePageContent({ params }: PageProps<"/[site]/[slug]">) {
  const { site: param, slug } = await params;
  const site = await getSiteForParam(param);
  if (!site) notFound();
  const page = await getPublishedPage(site.tenant.id, slug);
  if (!page) notFound();
  return <CmsPage page={page} />;
}

// Reading params inside Suspense keeps the route's shared shell (header, footer) free of URL
// data, so navigation shows it instantly while the page streams in (Partial Prefetching).
export default function SitePage(props: PageProps<"/[site]/[slug]">) {
  return (
    <Suspense fallback={<CmsPageSkeleton />}>
      <SitePageContent {...props} />
    </Suspense>
  );
}
