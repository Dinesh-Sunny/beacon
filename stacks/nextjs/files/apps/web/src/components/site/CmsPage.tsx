import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RenderBlocks } from "@/components/site/RenderBlocks";
import { Section } from "@/components/site/Section";
import { pagePath } from "@/lib/cms";
import { pageMetadata } from "@/lib/metadata";
import { ogImagePath } from "@/lib/og";
import { markdownPath } from "@/lib/page-path";
import { faqJsonLd, type JsonLdThing } from "@/lib/structured-data";
import { HOME_SLUG } from "@/payload/constants";
import type { Page } from "@/payload-types";

export function cmsPageMetadata(page: Page): Metadata {
  const metadata = pageMetadata({
    title: page.title,
    // No CMS description: leave it out rather than reuse the site's generic one.
    description: page.description ?? null,
    path: pagePath(page.slug),
    image: ogImagePath(
      page.slug === HOME_SLUG ? null : page.slug,
      page.updatedAt,
    ),
  });
  // Tells agents where the same page is as Markdown.
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: { "text/markdown": markdownPath(page.slug) },
    },
  };
}

// A published page's sections. When it doesn't open with a hero, the title becomes the h1 so
// every page has exactly one.
export function CmsPage({
  page,
  jsonLd = [],
}: {
  page: Page;
  jsonLd?: JsonLdThing[];
}) {
  const faq = faqJsonLd(page.layout);
  const items = faq ? [...jsonLd, faq] : jsonLd;
  const opensWithHero = page.layout?.[0]?.blockType === "hero";
  return (
    <>
      {items.length > 0 && <JsonLd items={items} />}
      {!opensWithHero && (
        <Section className="pb-0 sm:pb-0">
          <h1 className="font-heading text-4xl text-balance sm:text-5xl">
            {page.title}
          </h1>
        </Section>
      )}
      <RenderBlocks
        blocks={page.layout}
        firstBlockClassName={opensWithHero ? undefined : "pt-8 sm:pt-10"}
      />
    </>
  );
}
