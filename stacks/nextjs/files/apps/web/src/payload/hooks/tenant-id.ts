// Pure so `node --test` runs it.
// The tenant a document belongs to: the multi-tenant plugin's `tenant` field, an id or (when
// populated) a document.
export function tenantIdOf(doc: unknown): string | null {
  if (typeof doc !== "object" || doc === null || !("tenant" in doc)) {
    return null;
  }
  const tenant = (doc as { tenant: unknown }).tenant;
  if (typeof tenant === "string") return tenant;
  if (typeof tenant === "object" && tenant !== null && "id" in tenant) {
    const id = (tenant as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}
