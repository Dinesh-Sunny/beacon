import type { MetadataRoute } from "next";
import { getPublishedSlugs, pagePath } from "@/lib/cms";
import { PUBLIC_ROUTES } from "@/lib/site";
import { getSiteForRequest } from "@/lib/tenant";
import { HOME_SLUG } from "@/payload/constants";

const CMS_PAGE_PRIORITY = 0.7;

// The sitemap of the site this request's host belongs to, with its canonical origin.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteForRequest();
  if (!site?.indexable) return [];
  const url = (path: string) => new URL(path, site.origin).toString();
  const codeRoutes = PUBLIC_ROUTES.map(
    ({ path, changeFrequency, priority }) => ({
      url: url(path),
      changeFrequency,
      priority,
    }),
  );
  // `/` is already a code route; the home page's CMS entry would duplicate it.
  const cmsPages = (await getPublishedSlugs(site.tenant.id))
    .filter((slug) => slug !== HOME_SLUG)
    .map((slug) => ({ url: url(pagePath(slug)), priority: CMS_PAGE_PRIORITY }));
  return [...codeRoutes, ...cmsPages];
}
