import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import type { Config } from "@/payload-types";
import { COLLECTIONS, ROLES } from "./constants";

// Tenant scoping for staff in the admin (docs/adr/0002-multi-tenancy.md). Admins are super admins
// across every tenant; editors get a tenants list on their user and see only those. The plugin
// doesn't scope anonymous reads: the public site filters by tenant itself (lib/cms.ts).
export const tenancyPlugin = multiTenantPlugin<Config>({
  tenantsSlug: COLLECTIONS.tenants,
  collections: {
    [COLLECTIONS.pages]: {},
    [COLLECTIONS.media]: {},
    [COLLECTIONS.navigation]: { isGlobal: true },
    // The shop (docs/adr/0003-commerce.md). Customers stay unscoped: a person shops anywhere.
    [COLLECTIONS.products]: {},
    [COLLECTIONS.variants]: {},
    [COLLECTIONS.variantTypes]: {},
    [COLLECTIONS.variantOptions]: {},
    [COLLECTIONS.carts]: {},
    [COLLECTIONS.orders]: {},
    [COLLECTIONS.transactions]: {},
  },
  userHasAccessToAllTenants: (user) => user.role === ROLES.admin,
  // Tenants are suspended, never deleted (Tenants access), so nothing to clean up.
  cleanupAfterTenantDelete: false,
  // The plugin would hide every user without the selected tenant, admins included.
  useUsersTenantFilter: false,
});
