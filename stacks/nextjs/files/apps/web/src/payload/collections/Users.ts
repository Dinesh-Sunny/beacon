import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import {
  canAccessAdmin,
  isAdmin,
  isAdminField,
  isAdminOrSelf,
} from "../access";
import { COLLECTIONS, ROLES } from "../constants";
import { forgotPasswordEmail } from "../reset-email";

// The account created on the admin's first-run screen becomes an admin; later accounts are
// created by admins, who pick the role (editor by default).
const firstUserIsAdmin: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") return data;
  const { totalDocs } = await req.payload.count({
    collection: COLLECTIONS.users,
    overrideAccess: true,
    req,
  });
  return totalDocs === 0 ? { ...data, role: ROLES.admin } : data;
};

// Staff accounts for the CMS admin. App customers sign in with Better Auth (phase 3), not here.
export const Users: CollectionConfig = {
  slug: COLLECTIONS.users,
  auth: { forgotPassword: forgotPasswordEmail },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role"],
  },
  access: {
    admin: canAccessAdmin,
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: { beforeChange: [firstUserIsAdmin] },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: ROLES.editor,
      options: [
        { label: "Admin", value: ROLES.admin },
        { label: "Editor", value: ROLES.editor },
      ],
      // Exposed on the session token for client-side checks; access functions read req.user.
      saveToJWT: true,
      access: { create: isAdminField, update: isAdminField },
    },
  ],
};
