import { AUTH_DB_SCHEMA } from "@__NAME__/auth/config";
import { getDb } from "@__NAME__/db";
import type { CollectionConfig, TextFieldSingleValidation } from "payload";
import { text } from "payload/shared";
import { isAdmin, isAuthenticated } from "../access";
import { tenantShopFields } from "../commerce/fields";
import {
  COLLECTIONS,
  DEFAULT_TENANT_SLUG,
  TENANT_STATUSES,
} from "../constants";
import { revalidateTenants } from "../hooks/revalidate";

// A hostname without scheme, port, or path, lowercase (what the router compares requests with).
const HOSTNAME =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
// A DNS label, so the slug can double as `<slug>.<base domain>`.
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const validateHostname: TextFieldSingleValidation = (value, options) => {
  if (value && !HOSTNAME.test(value)) {
    return "Use a lowercase hostname like shop.example.com (no https:// or path).";
  }
  return text(value, options);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The organization must exist in Better Auth (its billing, team, and audit trail belong to it).
const validateOrganization: TextFieldSingleValidation = async (
  value,
  options,
) => {
  if (!value) return text(value, options);
  // Unchanged ids aren't looked up again, so a tenant whose organization was deleted can still
  // be suspended or edited.
  if (value === options.previousValue) return true;
  if (!UUID.test(value)) return "Paste the organization's ID (a UUID).";
  const { rows } = await getDb().$client.query(
    `select 1 from ${AUTH_DB_SCHEMA}.organization where id = $1::uuid`,
    [value],
  );
  return rows.length > 0 ? true : "No organization has this ID.";
};

const validateSlug: TextFieldSingleValidation = (value, options) => {
  // The default site is found by its slug; renaming it would take every fallback host down.
  if (
    options.previousValue === DEFAULT_TENANT_SLUG &&
    value !== DEFAULT_TENANT_SLUG
  ) {
    return `The "${DEFAULT_TENANT_SLUG}" site's slug can't change.`;
  }
  if (value && !DNS_LABEL.test(value)) {
    return "Use lowercase letters, numbers, and hyphens (it can become a subdomain).";
  }
  return text(value, options);
};

// One client site in a multi-tenant deployment (docs/adr/0002-multi-tenancy.md). Only admins
// (super admins across tenants) create or change tenants; editors see the ones they belong to.
// The `default` tenant answers any host that isn't listed here, so single-tenant forks need no
// setup.
export const Tenants: CollectionConfig = {
  slug: COLLECTIONS.tenants,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "status", "updatedAt"],
  },
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    // Suspend instead: deleting would orphan the tenant's pages and media.
    delete: () => false,
  },
  hooks: { afterChange: [revalidateTenants] },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      validate: validateSlug,
      admin: {
        description: `Lowercase, used in URLs and subdomains. "${DEFAULT_TENANT_SLUG}" is the fallback site.`,
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [...TENANT_STATUSES],
      admin: { description: "Suspended sites answer 404 on their domains." },
    },
    {
      name: "domains",
      type: "array",
      admin: {
        description:
          "Hostnames that serve this site. Attach each one to the project in Vercel too.",
      },
      fields: [
        {
          name: "domain",
          type: "text",
          required: true,
          unique: true,
          index: true,
          validate: validateHostname,
        },
        {
          name: "primary",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "The canonical host for links, sitemaps, and social cards.",
          },
        },
      ],
    },
    {
      name: "organizationId",
      label: "Organization ID",
      type: "text",
      unique: true,
      index: true,
      validate: validateOrganization,
      admin: {
        description:
          "The Better Auth organization this site belongs to (billing, team, audit). Empty only for the default site.",
      },
    },
    tenantShopFields,
    {
      name: "identity",
      type: "group",
      admin: {
        description:
          "Overrides the base site name and description on this site.",
      },
      fields: [
        { name: "siteName", type: "text" },
        { name: "description", type: "textarea" },
      ],
    },
  ],
};
