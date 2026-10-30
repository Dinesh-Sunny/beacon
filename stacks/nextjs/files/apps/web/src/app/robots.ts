import type { MetadataRoute } from "next";
import { PRIVATE_PATH_PREFIXES, PRIVATE_ROUTES } from "@/lib/site";
import { getSiteForRequest } from "@/lib/tenant";

// Per site: only an indexable site (production, real canonical origin) invites crawlers.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteForRequest();
  if (!site?.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROUTES, ...PRIVATE_PATH_PREFIXES],
    },
    sitemap: new URL("/sitemap.xml", site.origin).toString(),
  };
}
