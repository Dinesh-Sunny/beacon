import type { AuditAction, AuditCategory, AuditEvent } from "@__NAME__/db";

// Words for the Activity page. Pure so it can be tested. Names come from the organization's
// current members; anyone else (removed, deleted) is described without one.

export const AUDIT_CATEGORY_LABELS = {
  account: "Account",
  organization: "Organization",
  members: "Members",
  apiKeys: "API keys",
  billing: "Billing",
  commerce: "Orders",
} as const satisfies Record<AuditCategory, string>;

export const FORMER_MEMBER = "Former member";
// The same, mid-sentence ("Removed a former member").
const FORMER_MEMBER_IN_SENTENCE = "a former member";
// Rows outlive code: an action renamed or removed since still shows, in its raw form.
const UNKNOWN_ACTION = "Changed something";
export const SYSTEM_ACTOR = "System";

type Names = ReadonlyMap<string, string>;

function memberName(names: Names, id: string | null): string {
  return (id && names.get(id)) ?? FORMER_MEMBER_IN_SENTENCE;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// " for £12.50" from minor units and an ISO currency, or nothing when either is missing.
function money(amount: unknown, currency: unknown): string {
  if (typeof amount !== "number" || typeof currency !== "string") return "";
  try {
    const formatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount / 100);
    return ` for ${formatted}`;
  } catch {
    return "";
  }
}

const DESCRIBE: {
  [Action in AuditAction]: (event: AuditEvent, names: Names) => string;
} = {
  "user.signed_up": () => "Created an account",
  "user.signed_in": () => "Signed in",
  "user.session_revoked": () => "Signed out a device",
  "user.password_changed": () => "Changed their password",
  "user.two_factor_enabled": () => "Turned on two-factor sign-in",
  "user.two_factor_disabled": () => "Turned off two-factor sign-in",
  "user.data_exported": () => "Downloaded their data",
  "user.deleted": () => "Deleted their account",
  "organization.created": () => "Created the organization",
  "organization.updated": () => "Updated the organization",
  "organization.deleted": () => "Deleted the organization",
  "member.added": (event, names) =>
    `Added ${memberName(names, event.targetId)} as ${text(event.metadata.role) ?? "member"}`,
  "member.removed": (event, names) =>
    `Removed ${memberName(names, event.targetId)}`,
  "member.role_changed": (event, names) =>
    `Changed ${memberName(names, event.targetId)} from ${text(event.metadata.previousRole) ?? "their role"} to ${text(event.metadata.role) ?? "a new role"}`,
  "invitation.created": (event) =>
    `Invited someone as ${text(event.metadata.role) ?? "member"}`,
  "invitation.accepted": () => "Accepted an invitation",
  "invitation.canceled": () => "Canceled an invitation",
  "invitation.rejected": () => "Declined an invitation",
  "api_key.created": (event) =>
    `Created API key ${text(event.metadata.name) ?? "without a name"}`,
  "api_key.deleted": (event) =>
    `Deleted API key ${text(event.metadata.name) ?? "without a name"}`,
  "order.created": (event) =>
    `Received an order${money(event.metadata.amount, event.metadata.currency)}`,
  "order.refunded": (event) =>
    `Refunded an order${money(event.metadata.amount, event.metadata.currency)}`,
  "subscription.changed": (event) =>
    `Subscription is now ${text(event.metadata.status) ?? "updated"}${text(event.metadata.plan) ? ` (${event.metadata.plan})` : ""}`,
};

export function describeAuditEvent(event: AuditEvent, names: Names): string {
  const describe = DESCRIBE[event.action] as
    | ((event: AuditEvent, names: Names) => string)
    | undefined;
  return describe
    ? describe(event, names)
    : `${UNKNOWN_ACTION} (${event.action})`;
}

export function auditActorName(event: AuditEvent, names: Names): string {
  if (!event.actorId) return SYSTEM_ACTOR;
  return names.get(event.actorId) ?? FORMER_MEMBER;
}
