import { cacheLife, cacheTag } from "next/cache";
import { publishedPageMarkdown } from "@/lib/agent-markdown";
import { getPrerenderSlugs, getPublishedPage } from "@/lib/cms";
import { escapeMarkdown, markdownLink } from "@/lib/markdown";
import { markdownPath } from "@/lib/page-path";
import { CACHE_TAGS, HOME_SLUG } from "@/payload/constants";
import type { Page } from "@/payload-types";

// llms.txt (https://llmstxt.org) for one site: what it is and where its pages are, as Markdown
// links to each page's Markdown. llms-full.txt inlines every page. Both cover the most recently
// updated published pages (the prerender limit), home first. Cached until a page is published
// or removed.

export type LlmsSite = {
  tenantId: string;
  origin: string;
  name: string;
  description: string;
};

async function publishedSlugs(tenantId: string): Promise<string[]> {
  const slugs = await getPrerenderSlugs(tenantId);
  return [
    ...slugs.filter((slug) => slug === HOME_SLUG),
    ...slugs.filter((slug) => slug !== HOME_SLUG),
  ];
}

function header(site: LlmsSite): string[] {
  return [
    `# ${escapeMarkdown(site.name)}`,
    `> ${escapeMarkdown(site.description)}`,
  ];
}

export async function llmsTxt(site: LlmsSite): Promise<string> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages(site.tenantId));
  const pages = (
    await Promise.all(
      (
        await publishedSlugs(site.tenantId)
      ).map((slug) => getPublishedPage(site.tenantId, slug)),
    )
  ).filter((page): page is Page => page !== null);
  const lines = pages.map((page) => {
    const url = new URL(markdownPath(page.slug), site.origin).toString();
    const entry = `- ${markdownLink(page.title, url)}`;
    return page.description
      ? `${entry}: ${escapeMarkdown(page.description)}`
      : entry;
  });
  return `${[...header(site), "## Pages", lines.join("\n")].join("\n\n")}\n`;
}

export async function llmsFullTxt(site: LlmsSite): Promise<string> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages(site.tenantId));
  const bodies = (
    await Promise.all(
      (
        await publishedSlugs(site.tenantId)
      ).map((slug) => publishedPageMarkdown(site.tenantId, slug, site.origin)),
    )
  ).filter((body): body is string => body !== null);
  return `${[...header(site), ...bodies].join("\n\n---\n\n")}\n`;
}
