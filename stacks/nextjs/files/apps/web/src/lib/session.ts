import type { OrgRole, STATEMENTS } from "@__NAME__/auth";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";

type Session = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>
>;

type Permissions = {
  [Resource in keyof typeof STATEMENTS]?: Array<
    (typeof STATEMENTS)[Resource][number]
  >;
};

export class UnauthenticatedError extends Error {
  override name = "UnauthenticatedError";
}

export class ForbiddenError extends Error {
  override name = "ForbiddenError";
}

// Reads request headers, so it makes the caller dynamic: call it inside a <Suspense> boundary
// (never inside "use cache") to keep the static shell. Deduped per request.
export const getSession = cache(async (): Promise<Session | null> => {
  // headers() first: during prerender it suspends here, before getAuth() reads env vars that a
  // build without BETTER_AUTH_URL doesn't have (arguments evaluate after the callee).
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

// For Server Components, Server Actions, and route handlers that need a signed-in user.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError("Sign in required");
  return session;
}

// Checks the signed-in user's role in their active organization against the shared statements.
export async function requireOrgPermission(
  permissions: Permissions,
): Promise<Session> {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw new ForbiddenError("No active organization");
  const result = await getAuth().api.hasPermission({
    headers: await headers(),
    body: { organizationId, permissions },
  });
  if (!result.success)
    throw new ForbiddenError("Missing organization permission");
  return session;
}

export type { OrgRole };
