import config from "@payload-config";
import {
  convertLexicalToMarkdown,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { cacheLife, cacheTag } from "next/cache";
import { getPublishedPage } from "@/lib/cms";
import { absoluteLinks, escapeMarkdown, markdownLink } from "@/lib/markdown";
import { parseSiteHref } from "@/lib/site-href";
import { richTextEditor } from "@/payload/blocks";
import { CACHE_TAGS } from "@/payload/constants";
import type { ActionLink, Page } from "@/payload-types";

// CMS pages as Markdown for AI agents and answer engines (llms.txt, `.md` URLs, and
// `Accept: text/markdown`). Same published content as the HTML page, without layout.

type LayoutBlock = NonNullable<Page["layout"]>[number];

// Site paths become absolute so the Markdown works out of context; unsafe hrefs are dropped.
// Absolute URLs for a site path, against the site's canonical origin.
function absolute(path: string, origin: string): string {
  return new URL(path, origin).toString();
}

function link(label: string, href: string, origin: string): string {
  const parsed = parseSiteHref(href);
  if (!parsed) return escapeMarkdown(label);
  return markdownLink(
    label,
    parsed.kind === "internal" ? absolute(parsed.href, origin) : parsed.href,
  );
}

function actions(
  list: ActionLink | null | undefined,
  origin: string,
): string[] {
  return (list ?? []).map((action) => link(action.label, action.href, origin));
}

let editorConfig: ReturnType<typeof editorConfigFactory.fromEditor> | undefined;

async function richTextToMarkdown(
  data: SerializedEditorState,
  origin: string,
): Promise<string> {
  editorConfig ??= editorConfigFactory.fromEditor({
    config: await config,
    editor: richTextEditor,
  });
  // Rich-text internal links come out as site paths; make them absolute like block links.
  return absoluteLinks(
    convertLexicalToMarkdown({ data, editorConfig: await editorConfig }),
    (path) => absolute(path, origin),
  );
}

function heading(level: 2 | 3, text: string): string {
  return `${"#".repeat(level)} ${escapeMarkdown(text)}`;
}

async function blockToMarkdown(
  block: LayoutBlock,
  origin: string,
): Promise<string[]> {
  switch (block.blockType) {
    case "hero":
    case "callToAction":
      return [
        heading(2, block.heading),
        ...(block.body ? [escapeMarkdown(block.body)] : []),
        ...actions(block.actions, origin),
      ];
    case "features":
      return [
        ...(block.heading ? [heading(2, block.heading)] : []),
        ...(block.body ? [escapeMarkdown(block.body)] : []),
        block.items
          .map((item) => {
            const title = `- **${escapeMarkdown(item.title)}**`;
            return item.body ? `${title}: ${escapeMarkdown(item.body)}` : title;
          })
          .join("\n"),
      ];
    case "richText":
      return [
        await richTextToMarkdown(
          block.content as SerializedEditorState,
          origin,
        ),
      ];
    case "faq":
      return [
        heading(2, block.heading ?? "Questions"),
        ...block.items.map(
          (item) =>
            `${heading(3, item.question)}\n\n${escapeMarkdown(item.answer)}`,
        ),
      ];
    default: {
      const unhandled: never = block;
      return unhandled;
    }
  }
}

export async function pageToMarkdown(
  page: Page,
  origin: string,
): Promise<string> {
  const parts = [`# ${escapeMarkdown(page.title)}`];
  if (page.description) parts.push(`> ${escapeMarkdown(page.description)}`);
  for (const block of page.layout ?? []) {
    parts.push(...(await blockToMarkdown(block, origin)));
  }
  return `${parts.filter(Boolean).join("\n\n")}\n`;
}

// Cached with the page's tags, so crawlers fetching Markdown don't re-convert it each time.
export async function publishedPageMarkdown(
  tenantId: string,
  slug: string,
  origin: string,
): Promise<string | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages(tenantId), CACHE_TAGS.page(tenantId, slug));
  const page = await getPublishedPage(tenantId, slug);
  return page ? pageToMarkdown(page, origin) : null;
}

// Markdown responses aren't for search indexes (the HTML page is canonical), and agents should
// know where the page lives.
export function markdownResponse(
  body: string,
  canonicalUrl: string | null,
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
      // The same URL can also answer in HTML (`Accept: text/markdown`); caches in front of
      // Vercel must keep the two apart.
      Vary: "Accept",
      ...(canonicalUrl && { Link: `<${canonicalUrl}>; rel="canonical"` }),
    },
  });
}
