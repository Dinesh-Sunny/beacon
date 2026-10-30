import type { CollectionConfig } from "payload";
import { isAdmin, isAuthenticated } from "../access";
import { COLLECTIONS } from "../constants";
import { linkArray } from "../fields/link";
import { revalidateNavigation } from "../hooks/revalidate";

const MAX_HEADER_LINKS = 6;
const MAX_FOOTER_LINKS = 12;

// Header and footer links for each tenant's site: one document per tenant (the multi-tenant
// plugin's `isGlobal`). Everyone can read it (it's on every page); only staff change it.
export const Navigation: CollectionConfig = {
  slug: COLLECTIONS.navigation,
  admin: { useAsTitle: "id" },
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAdmin,
  },
  hooks: { afterChange: [revalidateNavigation] },
  fields: [
    linkArray("header", { maxRows: MAX_HEADER_LINKS }),
    linkArray("footer", { maxRows: MAX_FOOTER_LINKS }),
  ],
};
