import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CmsPage, cmsPageMetadata } from "@/components/site/CmsPage";
import { CmsPageSkeleton } from "@/components/site/CmsPageSkeleton";
import { HomeSetup } from "@/components/site/HomeSetup";
import { getPublishedPage } from "@/lib/cms";
import { pageMetadata } from "@/lib/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { getSiteForParam } from "@/lib/tenant";
import { HOME_SLUG } from "@/payload/constants";

export async function generateMetadata({
  params,
}: PageProps<"/[site]">): Promise<Metadata> {
  const site = await getSiteForParam((await params).site);
  if (!site) return {};
  const page = await getPublishedPage(site.tenant.id, HOME_SLUG);
  if (!page) {
    return pageMetadata({ title: site.name, path: "/", noIndex: true });
  }
  // The "%s · name" template would repeat the name on the home page.
  return { ...cmsPageMetadata(page), title: { absolute: page.title } };
}

async function HomeContent({ params }: PageProps<"/[site]">) {
  const site = await getSiteForParam((await params).site);
  if (!site) notFound();
  const page = await getPublishedPage(site.tenant.id, HOME_SLUG);
  if (!page) return <HomeSetup site={site} />;
  return (
    <CmsPage
      page={page}
      jsonLd={[organizationJsonLd(site), websiteJsonLd(site)]}
    />
  );
}

// The site's published CMS page with slug `home`; until an editor publishes one, a setup page.
export default function Home(props: PageProps<"/[site]">) {
  return (
    <Suspense fallback={<CmsPageSkeleton />}>
      <HomeContent {...props} />
    </Suspense>
  );
}
