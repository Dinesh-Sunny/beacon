import type {
  DefaultNodeTypes,
  SerializedLinkNode,
} from "@payloadcms/richtext-lexical";
import {
  type JSXConvertersFunction,
  RichText,
} from "@payloadcms/richtext-lexical/react";
import type { BlockProps } from "@/components/site/blocks/types";
import { CmsLink } from "@/components/site/CmsLink";
import { Section } from "@/components/site/Section";
import { pagePath } from "@/lib/cms";
import { COLLECTIONS } from "@/payload/constants";
import type { RichTextBlock as RichTextBlockData } from "@/payload-types";

// Internal links point at a page document; external ones go through the same href check as
// every other CMS link, so a pasted javascript: URL renders as text.
function linkHref(node: SerializedLinkNode): string {
  if (node.fields.linkType !== "internal") return node.fields.url ?? "";
  const target = node.fields.doc;
  // The editor only offers pages, but older content could point anywhere.
  if (target?.relationTo !== COLLECTIONS.pages) return "";
  const page = target.value;
  return typeof page === "object" &&
    "slug" in page &&
    typeof page.slug === "string"
    ? pagePath(page.slug)
    : "";
}

const converters: JSXConvertersFunction<DefaultNodeTypes> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  link: ({ node, nodesToJSX }) => (
    <CmsLink href={linkHref(node)} newTab={node.fields.newTab}>
      {nodesToJSX({ nodes: node.children })}
    </CmsLink>
  ),
  autolink: ({ node, nodesToJSX }) => (
    <CmsLink href={node.fields.url ?? ""} newTab={node.fields.newTab}>
      {nodesToJSX({ nodes: node.children })}
    </CmsLink>
  ),
});

export function RichTextBlock({
  block,
  className,
}: BlockProps<RichTextBlockData>) {
  return (
    <Section className={className}>
      <RichText
        data={block.content}
        converters={converters}
        className="cms-prose"
      />
    </Section>
  );
}
