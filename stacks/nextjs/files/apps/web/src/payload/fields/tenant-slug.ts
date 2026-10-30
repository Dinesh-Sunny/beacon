import type { CollectionSlug, TextFieldSingleValidation } from "payload";
import { text } from "payload/shared";
import { tenantIdOf } from "../hooks/tenant-id";

// Slugs are unique per site, not across the deployment. Checked in the field so the editor sees
// it inline instead of a database error; a compound (tenant, slug) index is the backstop.
export function uniqueSlugPerTenant(
  collection: CollectionSlug,
  { noun, reserved }: { noun: string; reserved?: ReadonlySet<string> },
): TextFieldSingleValidation {
  return async (value, options) => {
    if (value && reserved?.has(value)) {
      return `"${value}" is used by a built-in page. Choose another slug.`;
    }
    const tenantId = tenantIdOf(options.data);
    if (value && !tenantId) return `Choose which site this ${noun} belongs to.`;
    if (value && tenantId) {
      const { totalDocs } = await options.req.payload.count({
        collection,
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { slug: { equals: value } },
            ...(options.id ? [{ id: { not_equals: options.id } }] : []),
          ],
        },
        overrideAccess: true,
        req: options.req,
      });
      if (totalDocs > 0) {
        return `Another ${noun} on this site already uses "${value}".`;
      }
    }
    return text(value, options);
  };
}
