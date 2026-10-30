import { type CollectionConfig, slugField } from "payload";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";
import {
  isAdmin,
  isAuthenticated,
  isPublishedOrAuthenticated,
} from "../access";
import { BLOCKS, COLLECTIONS } from "../constants";
import { uniqueSlugPerTenant } from "../fields/tenant-slug";
import {
  rememberPublishedSlug,
  revalidatePageOnChange,
  revalidatePageOnDelete,
} from "../hooks/revalidate";

const validateSlug = uniqueSlugPerTenant(COLLECTIONS.pages, {
  noun: "page",
  reserved: RESERVED_SLUGS,
});

// Seconds-level autosave keeps drafts current without a version per keystroke.
const AUTOSAVE_INTERVAL_MS = 2_000;
const MAX_VERSIONS_PER_PAGE = 50;

export const Pages: CollectionConfig = {
  slug: COLLECTIONS.pages,
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "_status", "updatedAt"],
  },
  access: {
    read: isPublishedOrAuthenticated,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAdmin,
  },
  defaultPopulate: { title: true, slug: true },
  indexes: [{ fields: ["tenant", "slug"], unique: true }],
  versions: {
    drafts: {
      autosave: { interval: AUTOSAVE_INTERVAL_MS },
      schedulePublish: true,
    },
    maxPerDoc: MAX_VERSIONS_PER_PAGE,
  },
  hooks: {
    beforeChange: [rememberPublishedSlug],
    afterChange: [revalidatePageOnChange],
    afterDelete: [revalidatePageOnDelete],
  },
  fields: [
    { name: "title", type: "text", required: true },
    // Unique per tenant (the compound index below), not across the whole deployment.
    slugField({
      disableUnique: true,
      overrides: (row) => ({
        ...row,
        fields: row.fields.map((field) =>
          "name" in field && field.name === "slug" && field.type === "text"
            ? // TextField is a union over hasMany; the slug is single-valued.
              ({ ...field, validate: validateSlug } as typeof field)
            : field,
        ),
      }),
    }),
    {
      name: "layout",
      type: "blocks",
      // Defined once in payload.config.ts `blocks`; `blocks` must stay empty with references.
      blockReferences: Object.values(BLOCKS),
      blocks: [],
      labels: { singular: "Section", plural: "Sections" },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Meta description for search and social cards." },
    },
  ],
};
