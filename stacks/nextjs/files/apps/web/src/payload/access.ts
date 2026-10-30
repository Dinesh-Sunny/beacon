import { timingSafeEqual } from "node:crypto";
import type { Access, FieldAccess, PayloadRequest, Where } from "payload";
import { ROLES } from "./constants";

// Every admin user is staff (admin or editor); site visitors never have a Payload user.
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user);

// Admin-panel entry takes a plain boolean, not a query.
export const canAccessAdmin = ({ req: { user } }: { req: PayloadRequest }) =>
  Boolean(user);

export const isAdmin: Access = ({ req: { user } }) =>
  user?.role === ROLES.admin;

export const isAdminField: FieldAccess = ({ req: { user } }) =>
  user?.role === ROLES.admin;

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === ROLES.admin) return true;
  const self: Where = { id: { equals: user.id } };
  return self;
};

// Vercel Cron calls the job runner with `Authorization: Bearer $CRON_SECRET`. Staff can also
// trigger it from the admin. Without CRON_SECRET only staff can run jobs.
export const canRunJobs = ({ req }: { req: PayloadRequest }): boolean => {
  if (req.user) return true;
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// Visitors see published documents only; staff also see drafts.
export const isPublishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true;
  const published: Where = { _status: { equals: "published" } };
  return published;
};
