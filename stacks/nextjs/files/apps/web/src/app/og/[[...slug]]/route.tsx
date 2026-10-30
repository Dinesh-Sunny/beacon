import { notFound } from "next/navigation";
import { TEXT_STATS_PAGE } from "@/app/(frontend)/(site)/[site]/text-stats/constants";
import { getPublishedPage } from "@/lib/cms";
import { renderOgImage } from "@/lib/generated-images";
import { getSiteForRequest } from "@/lib/tenant";
import { HOME_SLUG } from "@/payload/constants";

// Cards for code pages, by the slug their metadata asks for. Fixed titles only: the route never
// renders text from the URL.
const CODE_PAGE_TITLES: Readonly<Record<string, string>> = {
  [TEXT_STATS_PAGE.path.slice(1)]: TEXT_STATS_PAGE.title,
};

// The social card for a page of the request's site (lib/og.ts): `/og` for the home page,
// `/og/<slug>` for a CMS or code page. Titled from the page, labelled with the site.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/[[...slug]]">,
): Promise<Response> {
  const { slug: segments = [] } = await params;
  if (segments.length > 1) notFound();
  const site = await getSiteForRequest();
  if (!site) notFound();
  const slug = segments[0] ?? HOME_SLUG;
  const title =
    CODE_PAGE_TITLES[slug] ??
    (await getPublishedPage(site.tenant.id, slug))?.title ??
    (slug === HOME_SLUG ? site.name : null);
  if (!title) notFound();
  return renderOgImage({ title, eyebrow: site.name, footer: site.origin.host });
}
