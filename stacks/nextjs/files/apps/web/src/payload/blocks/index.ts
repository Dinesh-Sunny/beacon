import { LinkFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import type { Block, TextFieldSingleValidation } from "payload";
import { pagePath } from "@/lib/page-path";
import { parseSiteHref } from "@/lib/site-href";
import { BLOCKS, COLLECTIONS, FEATURE_ICONS } from "../constants";
import { linkArray } from "../fields/link";
import { tenantIdOf } from "../hooks/tenant-id";

// Page sections editors compose in `pages.layout`. Defined once in the config (`blocks`) and
// referenced by slug, which Payload documents as the cheaper form. Each block's frontend
// renderer is in components/site/blocks/.

const HEADING_MAX = 120;
const BODY_MAX = 400;

const Hero: Block = {
  slug: BLOCKS.hero,
  interfaceName: "HeroBlock",
  labels: { singular: "Hero", plural: "Heroes" },
  fields: [
    {
      name: "heading",
      type: "text",
      required: true,
      maxLength: HEADING_MAX,
    },
    { name: "body", type: "textarea", maxLength: BODY_MAX },
    linkArray("actions", { maxRows: 2, appearance: true }),
    {
      name: "media",
      type: "upload",
      relationTo: COLLECTIONS.media,
      // Only the page's own site's images (the tenant plugin scopes relationships, not uploads).
      filterOptions: ({ data }) => {
        const tenantId = tenantIdOf(data);
        return tenantId ? { tenant: { equals: tenantId } } : false;
      },
      admin: { description: "Optional image beside the heading." },
    },
  ],
};

const Features: Block = {
  slug: BLOCKS.features,
  interfaceName: "FeaturesBlock",
  labels: { singular: "Feature list", plural: "Feature lists" },
  fields: [
    { name: "heading", type: "text", maxLength: HEADING_MAX },
    { name: "body", type: "textarea", maxLength: BODY_MAX },
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 2,
      maxRows: 9,
      labels: { singular: "Feature", plural: "Features" },
      fields: [
        {
          name: "icon",
          type: "select",
          options: [...FEATURE_ICONS],
          admin: { description: "Optional." },
        },
        { name: "title", type: "text", required: true, maxLength: 80 },
        { name: "body", type: "textarea", maxLength: 240 },
      ],
    },
  ],
};

const CallToAction: Block = {
  slug: BLOCKS.callToAction,
  interfaceName: "CallToActionBlock",
  labels: { singular: "Call to action", plural: "Calls to action" },
  fields: [
    {
      name: "heading",
      type: "text",
      required: true,
      maxLength: HEADING_MAX,
    },
    { name: "body", type: "textarea", maxLength: BODY_MAX },
    linkArray("actions", { minRows: 1, maxRows: 2, appearance: true }),
  ],
};

// Custom links in rich text follow the same rule as every other CMS link, checked on save so
// editors see the error instead of a link that silently renders as text. Internal links point
// at pages only. Relationship embeds are off: the site has nothing to render them as.
const validateRichTextUrl: TextFieldSingleValidation = (
  value,
  { siblingData },
) => {
  const linkType = (siblingData as { linkType?: string }).linkType;
  if (linkType === "internal") return true;
  return value && parseSiteHref(value)
    ? true
    : "Use a site path like /about, an https:// address, or mailto:.";
};

const RICH_TEXT_DISABLED_FEATURES = new Set(["link", "relationship"]);

export const richTextEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      (feature) => !RICH_TEXT_DISABLED_FEATURES.has(feature.key),
    ),
    LinkFeature({
      enabledCollections: [COLLECTIONS.pages],
      maxDepth: 1,
      // For the Markdown agents read (lib/agent-markdown.ts).
      internalDocToHref: ({ linkNode }) => {
        const page = linkNode.fields.doc?.value;
        return page &&
          typeof page === "object" &&
          "slug" in page &&
          typeof page.slug === "string"
          ? pagePath(page.slug)
          : "";
      },
      fields: ({ defaultFields }) =>
        defaultFields.map((field) =>
          field.name === "url" && field.type === "text"
            ? // TextField is a union over hasMany; the URL is single-valued.
              ({ ...field, validate: validateRichTextUrl } as typeof field)
            : field,
        ),
    }),
  ],
});

const RichText: Block = {
  slug: BLOCKS.richText,
  interfaceName: "RichTextBlock",
  labels: { singular: "Text", plural: "Text" },
  fields: [
    {
      name: "content",
      type: "richText",
      required: true,
      editor: richTextEditor,
    },
  ],
};

const Faq: Block = {
  slug: BLOCKS.faq,
  interfaceName: "FaqBlock",
  labels: { singular: "FAQ", plural: "FAQs" },
  fields: [
    { name: "heading", type: "text", maxLength: HEADING_MAX },
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      maxRows: 20,
      labels: { singular: "Question", plural: "Questions" },
      fields: [
        { name: "question", type: "text", required: true, maxLength: 200 },
        {
          name: "answer",
          type: "textarea",
          required: true,
          maxLength: 1200,
          admin: {
            description:
              "Plain text; also published as FAQ data for search engines.",
          },
        },
      ],
    },
  ],
};

export const PAGE_BLOCKS: Block[] = [
  Hero,
  Features,
  CallToAction,
  RichText,
  Faq,
];
