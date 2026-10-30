import { ORG_ROLES, type OrgRole } from "@__NAME__/auth/access";
import { SITE } from "@/lib/site";

// Display names for organization roles. A plain module so server pages and client forms share it.
export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ALL_ROLES = Object.keys(ORG_ROLES) as OrgRole[];

// Ownership moves only by an explicit transfer, never by invitation.
export const INVITABLE_ROLES = ALL_ROLES.filter((role) => role !== "owner");

export function roleLabel(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as OrgRole] : role;
}

// "admin,member" (how Better Auth stores several roles) → "Admin and Member".
export function roleListLabel(
  roles: string,
  locale: string = SITE.language,
): string {
  const labels = roles
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .map(roleLabel);
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(labels);
}

// Better Auth stores several roles as "admin,owner".
export function hasRole(
  roles: string | null | undefined,
  role: OrgRole,
): boolean {
  return Boolean(roles?.split(",").includes(role));
}
