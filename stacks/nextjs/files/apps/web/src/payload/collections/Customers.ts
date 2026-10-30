import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";
import { COLLECTIONS } from "../constants";

// The ecommerce plugin's customer target (docs/adr/0003-commerce.md). Shoppers sign in with Better
// Auth, never Payload: this is a link, one document per Better Auth user who checked out signed
// in, created by the checkout service. No password, no Payload login. Admin-only in the CMS.
export const Customers: CollectionConfig = {
  slug: COLLECTIONS.customers,
  admin: { useAsTitle: "email", defaultColumns: ["email", "createdAt"] },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "betterAuthUserId",
      label: "Account ID",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    // Snapshot for staff and receipts; the account's email can't change (docs/knowledge/auth.md).
    { name: "email", type: "email", required: true },
  ],
};
