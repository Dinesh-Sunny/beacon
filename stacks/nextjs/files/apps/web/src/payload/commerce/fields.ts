import type { Field } from "payload";
import { MAX_SHIPPING_RATES } from "@/lib/commerce/config";
import {
  COLLECTIONS,
  DEFAULT_SHOP_CURRENCY,
  SHOP_CURRENCIES,
} from "../constants";
import { uniqueSlugPerTenant } from "../fields/tenant-slug";

// Countries a tenant can ship to (ISO 3166-1 alpha-2, what Stripe Checkout accepts). Forks add
// their own; Stripe offers only these at checkout.
export const SHIPPING_COUNTRIES = [
  { label: "United Kingdom", value: "GB" },
  { label: "Ireland", value: "IE" },
  { label: "France", value: "FR" },
  { label: "Germany", value: "DE" },
  { label: "Netherlands", value: "NL" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
  { label: "United States", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
] as const;

// The shop settings on a tenant: what it sells in and how it ships (docs/adr/0003-commerce.md).
export const tenantShopFields: Field = {
  name: "shop",
  type: "group",
  admin: { description: "Prices, shipping, and where this site sells." },
  fields: [
    {
      name: "currency",
      type: "select",
      required: true,
      defaultValue: DEFAULT_SHOP_CURRENCY,
      options: [...SHOP_CURRENCIES],
      admin: {
        description:
          "Products are priced in this currency. Stripe shows visitors abroad a local price at checkout.",
      },
    },
    {
      name: "shipsTo",
      type: "select",
      hasMany: true,
      defaultValue: ["GB"],
      options: SHIPPING_COUNTRIES.map((country) => ({ ...country })),
    },
    {
      name: "shippingRates",
      type: "array",
      maxRows: MAX_SHIPPING_RATES,
      admin: {
        description:
          "Flat rates offered at checkout for physical products, in the site's currency. Empty: free shipping.",
      },
      fields: [
        { name: "label", type: "text", required: true, maxLength: 50 },
        {
          name: "amount",
          type: "number",
          required: true,
          min: 0,
          admin: { description: "In the smallest unit (pence, cents)." },
        },
      ],
    },
  ],
};

// Physical products need an address and shipping at checkout; digital ones don't.
export const requiresShippingField: Field = {
  name: "requiresShipping",
  type: "checkbox",
  defaultValue: true,
  admin: { position: "sidebar", description: "Off for digital products." },
};

// Where an order ships, copied from Stripe Checkout (the plugin's addresses are off: Stripe
// collects them). Reduced to the country when the buyer's data is erased.
export const orderShippingField: Field = {
  name: "shipping",
  type: "group",
  admin: { readOnly: true },
  fields: [
    { name: "name", type: "text" },
    { name: "line1", type: "text" },
    { name: "line2", type: "text" },
    { name: "city", type: "text" },
    { name: "postalCode", type: "text" },
    { name: "country", type: "text" },
    { name: "rate", label: "Shipping rate", type: "text" },
  ],
};

// Stock can run out between checkout and payment (no reservations); such orders are flagged for
// staff instead of failing a paid order.
export const needsReviewField: Field = {
  name: "needsReview",
  type: "checkbox",
  defaultValue: false,
  admin: {
    position: "sidebar",
    description: "Set when an item was oversold. Check stock before shipping.",
  },
};

// Products need what the storefront shows: a title, a URL slug unique within the site, words, and
// images from the site's own media.
export const productFields: Field[] = [
  { name: "title", type: "text", required: true, maxLength: 120 },
  {
    name: "slug",
    type: "text",
    required: true,
    index: true,
    validate: uniqueSlugPerTenant(COLLECTIONS.products, { noun: "product" }),
    admin: {
      position: "sidebar",
      description: "Used in the product's URL: /shop/<slug>.",
    },
  },
  { name: "description", type: "textarea", maxLength: 2000 },
  {
    name: "images",
    type: "upload",
    relationTo: COLLECTIONS.media,
    hasMany: true,
    maxRows: 8,
    filterOptions: ({ data }) => {
      const tenant = (data as { tenant?: unknown })?.tenant;
      const tenantId =
        typeof tenant === "string"
          ? tenant
          : typeof tenant === "object" && tenant !== null && "id" in tenant
            ? String((tenant as { id: unknown }).id)
            : null;
      return tenantId ? { tenant: { equals: tenantId } } : false;
    },
  },
];
