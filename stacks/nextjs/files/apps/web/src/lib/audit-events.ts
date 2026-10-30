import type { AuthEvent } from "@__NAME__/auth";
import type { AuditEventInput } from "@__NAME__/db";

// Which auth events become audit rows, and how. Pure so it can be tested. Profile edits
// (`user.updated`) aren't recorded: frequent, and nothing security-relevant on their own.
export function toAuditEvent(event: AuthEvent): AuditEventInput | null {
  switch (event.type) {
    case "user.created":
      return { action: "user.signed_up", actorId: event.userId };
    case "user.updated":
      return null;
    case "user.deleted":
      return {
        action: "user.deleted",
        actorId: event.userId,
        target: { type: "user", id: event.userId },
      };
    case "user.password_changed":
      return { action: "user.password_changed", actorId: event.userId };
    case "user.two_factor_changed":
      return {
        action: event.enabled
          ? "user.two_factor_enabled"
          : "user.two_factor_disabled",
        actorId: event.userId,
      };
    // Session rows also come and go when two-factor or a reset replaces them; only finished
    // sign-ins and deliberate sign-outs are recorded.
    case "session.created":
      return null;
    case "user.signed_in":
      return {
        action: "user.signed_in",
        actorId: event.userId,
        target: { type: "session", id: event.sessionId },
      };
    case "session.revoked":
      if (!event.userInitiated) return null;
      return {
        action: "user.session_revoked",
        actorId: event.userId,
        target: { type: "session", id: event.sessionId },
      };
    case "organization.created":
    case "organization.updated":
    case "organization.deleted":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "organization", id: event.organizationId },
      };
    case "member.added":
    case "member.removed":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "user", id: event.memberUserId },
        metadata: { role: event.role },
      };
    case "member.role_changed":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "user", id: event.memberUserId },
        metadata: { role: event.role, previousRole: event.previousRole },
      };
    case "invitation.created":
    case "invitation.accepted":
    case "invitation.canceled":
    case "invitation.rejected":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "invitation", id: event.invitationId },
        metadata: { role: event.role },
      };
    case "api_key.created":
    case "api_key.deleted":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "api_key", id: event.keyId },
        metadata: { name: event.name },
      };
    case "subscription.changed":
      return {
        action: event.type,
        actorId: event.actorId,
        organizationId: event.organizationId,
        target: { type: "organization", id: event.organizationId },
        metadata: { plan: event.plan, status: event.status },
      };
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}
