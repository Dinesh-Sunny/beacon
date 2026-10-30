// Organization roles and permissions. Shared by the server (organization plugin) and the client
// (organizationClient), so both sides check the same statements.
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const STATEMENTS = {
  ...defaultStatements,
  // Action names the api-key plugin checks for organization-owned keys.
  apiKey: ["create", "read", "update", "delete"],
  billing: ["read", "manage"],
  // The organization's audit log (Activity page).
  audit: ["read"],
} as const;

export const ac = createAccessControl(STATEMENTS);

export const ORG_ROLES = {
  owner: ac.newRole({
    ...ownerAc.statements,
    apiKey: ["create", "read", "update", "delete"],
    billing: ["read", "manage"],
    audit: ["read"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    apiKey: ["create", "read", "update", "delete"],
    billing: ["read"],
    audit: ["read"],
  }),
  member: ac.newRole({ ...memberAc.statements }),
};

export type OrgRole = keyof typeof ORG_ROLES;

// The role that can delete an organization and manage its owners.
export const OWNER_ROLE = "owner" satisfies OrgRole;
