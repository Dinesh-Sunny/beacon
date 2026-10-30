import {
  type AuditCategory,
  type AuditCursor,
  getDb,
  listAuditEvents,
} from "@__NAME__/db";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { AUTH_ROUTES, withNext } from "@/lib/auth-routes";
import { getSession } from "@/lib/session";

// Events per Activity page; "Older" loads the next page.
const ACTIVITY_PAGE_SIZE = 50;

// What the account shell needs on every page: who you are, your organizations, and the one you
// act for. Cached per request, so the layout and the page share one read. Null when signed out.
export const loadAccountContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const requestHeaders = await headers();
  const organizations = await getAuth().api.listOrganizations({
    headers: requestHeaders,
  });
  // A stale active id (you left that org) falls back to your first organization.
  const activeOrganization =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId,
    ) ??
    organizations[0] ??
    null;
  const role = activeOrganization
    ? (
        await getAuth().api.getActiveMemberRole({
          headers: requestHeaders,
          query: { organizationId: activeOrganization.id },
        })
      ).role
    : null;
  return {
    user: session.user,
    currentSessionId: session.session.id,
    organizations: organizations.map(({ id, name }) => ({ id, name })),
    activeOrganization: activeOrganization
      ? { id: activeOrganization.id, name: activeOrganization.name, role }
      : null,
  };
});

export type AccountContext = NonNullable<
  Awaited<ReturnType<typeof loadAccountContext>>
>;

// For account pages. proxy.ts only checks that a cookie exists; an expired or revoked session
// (signed out from another device) lands here and goes to sign-in, back to this page after.
export async function getAccountContext(
  from: Route = AUTH_ROUTES.account,
): Promise<AccountContext> {
  const context = await loadAccountContext();
  if (!context) redirect(withNext(AUTH_ROUTES.signIn, from));
  return context;
}

function can(organizationId: string, permissions: Record<string, string[]>) {
  return headers().then((requestHeaders) =>
    getAuth()
      .api.hasPermission({
        headers: requestHeaders,
        body: { organizationId, permissions },
      })
      .then((result) => result.success),
  );
}

// Session tokens of other devices stay on the server: the page only offers "sign out other
// devices", never per-token revoke.
export async function loadSessions() {
  const sessions = await getAuth().api.listSessions({
    headers: await headers(),
  });
  return sessions.map(({ id, userAgent, updatedAt, createdAt }) => ({
    id,
    device: userAgent,
    lastActive: updatedAt ?? createdAt,
  }));
}

export async function loadTeam(from: Route) {
  const { activeOrganization } = await getAccountContext(from);
  if (!activeOrganization) return null;
  const [organization, canManageMembers] = await Promise.all([
    getAuth().api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: activeOrganization.id },
    }),
    can(activeOrganization.id, { invitation: ["create"] }),
  ]);
  if (!organization) return null;
  return {
    organization,
    canManageMembers,
    pendingInvitations: organization.invitations.filter(
      (invite) => invite.status === "pending",
    ),
  };
}

export async function loadApiKeys(from: Route) {
  const { activeOrganization } = await getAccountContext(from);
  if (!activeOrganization) return null;
  const [canReadKeys, canManageKeys] = await Promise.all([
    can(activeOrganization.id, { apiKey: ["read"] }),
    can(activeOrganization.id, { apiKey: ["create"] }),
  ]);
  // Members without apiKey:read get a 403 from listApiKeys, so only ask when allowed.
  const apiKeys = canReadKeys
    ? (
        await getAuth().api.listApiKeys({
          headers: await headers(),
          query: { organizationId: activeOrganization.id },
        })
      ).apiKeys
    : [];
  return {
    organization: activeOrganization,
    canReadKeys,
    canManageKeys,
    apiKeys,
  };
}

// Organization activity (audit log), newest first, one page at a time. Owners and admins only
// (`audit:read`). Names resolve for people who are still members.
export async function loadActivity(
  from: Route,
  options: { category: AuditCategory | null; cursor: AuditCursor | null },
) {
  const { activeOrganization } = await getAccountContext(from);
  if (!activeOrganization) return null;
  const canRead = await can(activeOrganization.id, { audit: ["read"] });
  if (!canRead) {
    return {
      organization: activeOrganization,
      canRead,
      page: null,
      names: null,
    };
  }
  const client = getDb().$client;
  const page = await listAuditEvents(
    client,
    { organizationId: activeOrganization.id },
    { limit: ACTIVITY_PAGE_SIZE, ...options },
  );
  // Names only for people on this page who are still members; anyone else shows as former.
  const ids = [
    ...new Set(
      page.events.flatMap((event) => [
        event.actorId,
        event.targetType === "user" ? event.targetId : null,
      ]),
    ),
  ].filter((id): id is string => id !== null);
  const { rows } = await client.query<{ user_id: string; name: string }>(
    `select m.user_id::text, u.name
       from auth.member m join auth."user" u on u.id = m.user_id
      where m.organization_id = $1::uuid and m.user_id::text = any($2::text[])`,
    [activeOrganization.id, ids],
  );
  const names = new Map(rows.map((row) => [row.user_id, row.name]));
  return { organization: activeOrganization, canRead, page, names };
}
