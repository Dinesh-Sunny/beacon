import { EUR, ecommercePlugin, GBP, USD } from "@payloadcms/plugin-ecommerce";
import type { Access, FieldAccess } from "payload";
import { isAuthenticated } from "../access";
import { COLLECTIONS, DEFAULT_SHOP_CURRENCY } from "../constants";
import {
  needsReviewField,
  orderShippingField,
  productFields,
  requiresShippingField,
} from "./fields";
import { stripeCheckoutAdapter } from "./stripe-checkout";

// Payload users are staff (admins and editors); shoppers are never Payload users. So "admin" in
// the plugin's sense is any staff member, and shoppers reach carts only through the cart secret
// (the plugin's guest path) and our server code.
const staffOnly: Access = ({ req }) => Boolean(req.user);
const staffOnlyField: FieldAccess = ({ req }) => Boolean(req.user);
const staffOrPublished: Access = ({ req }) =>
  req.user ? true : { _status: { equals: "published" } };

// The shop (docs/adr/0003-commerce.md): products, variants, carts, orders, transactions from the
// ecommerce plugin, paid through our Stripe Checkout adapter. Addresses are off: Stripe collects
// them. Tenant scoping comes from the multi-tenant plugin, which must run after this one.
export const commercePlugin = ecommercePlugin({
  access: {
    isAdmin: staffOnly,
    isAuthenticated,
    adminOnlyFieldAccess: staffOnlyField,
    adminOrPublishedStatus: staffOrPublished,
    isDocumentOwner: staffOnly,
    isCustomer: () => false,
  },
  customers: { slug: COLLECTIONS.customers },
  addresses: false,
  currencies: {
    supportedCurrencies: [GBP, EUR, USD],
    defaultCurrency: DEFAULT_SHOP_CURRENCY,
  },
  products: {
    productsCollectionOverride: ({ defaultCollection }) => ({
      ...defaultCollection,
      admin: {
        ...defaultCollection.admin,
        useAsTitle: "title",
        defaultColumns: ["title", "slug", "_status", "updatedAt"],
      },
      indexes: [{ fields: ["tenant", "slug"], unique: true }],
      fields: [
        ...productFields,
        ...defaultCollection.fields,
        requiresShippingField,
      ],
    }),
  },
  orders: {
    ordersCollectionOverride: ({ defaultCollection }) => ({
      ...defaultCollection,
      fields: [
        ...defaultCollection.fields,
        orderShippingField,
        needsReviewField,
      ],
    }),
  },
  payments: { paymentMethods: [stripeCheckoutAdapter] },
});
