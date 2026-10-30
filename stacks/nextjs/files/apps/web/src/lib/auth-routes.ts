import { AUTH_PAGES } from "@__NAME__/auth/config";
import type { Route } from "next";
import { isSafeRelativePath } from "./safe-path";

// App pages for sign-in flows. The accept-invitation path is shared with the invite email
// (packages/auth AUTH_PAGES), so it lives there.
export const AUTH_ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  twoFactor: "/two-factor",
  account: "/account",
  accountSecurity: "/account/security",
  accountTeam: "/account/team",
  accountApiKeys: "/account/api-keys",
  accountBilling: "/account/billing",
  accountAssistant: "/account/assistant",
  accountActivity: "/account/activity",
  twoFactorSetup: "/account/security/two-factor",
} as const satisfies Record<string, Route>;

export const ACCEPT_INVITATION_PATH = AUTH_PAGES.acceptInvitation;

// Where sign-in sends people back to: same-site paths only (see safe-path.ts).
export function safeNextPath(
  value: string | string[] | undefined | null,
  fallback: Route = AUTH_ROUTES.account,
): Route {
  const path = Array.isArray(value) ? value[0] : value;
  // Checked above, so treating it as a typed route is safe.
  return path && isSafeRelativePath(path) ? (path as Route) : fallback;
}

export function withNext(route: Route, next: string | undefined): Route {
  return (next ? `${route}?next=${encodeURIComponent(next)}` : route) as Route;
}

export function invitationPath(id: string): Route {
  return `${ACCEPT_INVITATION_PATH}/${encodeURIComponent(id)}` as Route;
}
