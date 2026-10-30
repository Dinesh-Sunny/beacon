import type { JsonLdThing } from "@/lib/json-ld";
import { SITE } from "@/lib/site";
import type { SiteContext } from "@/lib/tenant";

export { faqJsonLd } from "@/lib/json-ld";
// schema.org JSON-LD builders. Keep them in step with the site's identity so search engines and
// AI crawlers see the same thing as the visible page.
export type { JsonLdThing };

function siteUrl(site: SiteContext, path: string): string {
  return new URL(path, site.origin).toString();
}

export function organizationJsonLd(site: SiteContext): JsonLdThing {
  return {
    "@type": "Organization",
    "@id": siteUrl(site, "/#organization"),
    name: site.name,
    url: siteUrl(site, "/"),
  };
}

export function websiteJsonLd(site: SiteContext): JsonLdThing {
  return {
    "@type": "WebSite",
    "@id": siteUrl(site, "/#website"),
    name: site.name,
    description: site.description,
    url: siteUrl(site, "/"),
    inLanguage: SITE.language,
    publisher: { "@id": siteUrl(site, "/#organization") },
  };
}
