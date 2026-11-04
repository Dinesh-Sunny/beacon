import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The public pages can be indexed; the API and a person's check can't.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/how"],
      disallow: ["/api/", "/check"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
