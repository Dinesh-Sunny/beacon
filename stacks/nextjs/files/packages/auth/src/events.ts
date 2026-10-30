// Typed auth events. Better Auth hooks call the sink; apps/web turns them into analytics and
// append-only audit rows (@__NAME__/db audit.ts). Ids only: no emails or names, so the audit log
// stops identifying anyone once their account is deleted.

// Who did it: the signed-in user of the request, or null for system work (webhooks, jobs).
type Actor = { actorId: string | null };
type InOrganization = Actor & { organizationId: string };

export type AuthEvent =
  | { type: "user.created"; userId: string }
  | { type: "user.updated"; userId: string }
  // The email goes only to erasure (shop orders placed as a guest); never to the audit log.
  | { type: "user.deleted"; userId: string; email: string }
  | { type: "user.password_changed"; userId: string }
  | { type: "user.two_factor_changed"; userId: string; enabled: boolean }
  // A session row was written; sign-ins that finished are `user.signed_in`.
  | { type: "session.created"; userId: string; sessionId: string }
  | { type: "user.signed_in"; userId: string; sessionId: string }
  | {
      type: "session.revoked";
      userId: string;
      sessionId: string;
      // Signed out or revoked on purpose, rather than replaced by Better Auth.
      userInitiated: boolean;
    }
  | ({
      type:
        | "organization.created"
        | "organization.updated"
        | "organization.deleted";
    } & InOrganization)
  | ({
      type: "member.added" | "member.removed";
      memberUserId: string;
      role: string;
    } & InOrganization)
  | ({
      type: "member.role_changed";
      memberUserId: string;
      role: string;
      previousRole: string;
    } & InOrganization)
  | ({
      type:
        | "invitation.created"
        | "invitation.accepted"
        | "invitation.canceled"
        | "invitation.rejected";
      invitationId: string;
      role: string;
    } & InOrganization)
  | ({
      type: "api_key.created" | "api_key.deleted";
      keyId: string;
      name: string | null;
    } & InOrganization)
  | ({
      type: "subscription.changed";
      plan: string;
      status: string;
    } & InOrganization);

export type AuthEventSink = (event: AuthEvent) => void | Promise<void>;

export const noopEventSink: AuthEventSink = () => {};
