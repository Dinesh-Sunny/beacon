// Auth emails go through one seam: apps/web passes a sender that renders the React Email
// templates and sends through @__NAME__/email. Without one, links are printed (development only).

import type { AuthEmailKind } from "./config.ts";

export type { AuthEmailKind };

// Who invited whom, so the invitation email can name them.
export type InvitationDetails = {
  organizationName: string;
  inviterName: string;
  role: string;
};

type LinkEmail = {
  kind: Exclude<AuthEmailKind, "org-invitation">;
  to: string;
  url: string;
};

// Invitations always carry their details, so a caller can't send "Someone invited you".
type InvitationEmail = {
  kind: "org-invitation";
  to: string;
  url: string;
  invitation: InvitationDetails;
};

export type AuthEmail = LinkEmail | InvitationEmail;

export type SendAuthEmail = (email: AuthEmail) => Promise<void>;

export class AuthEmailNotConfiguredError extends Error {
  override name = "AuthEmailNotConfiguredError";
}

// The latest dev email per kind and address, so the inbox screens can offer the link without a
// mail server. Kept on globalThis because Next dev reloads modules and route handlers can get their
// own copy; a module-level Map would lose what the auth handler recorded.
const OUTBOX_KEY = Symbol.for("__NAME__.auth.devOutbox");
type DevOutbox = Map<string, AuthEmail>;

function devOutbox(): DevOutbox {
  const store = globalThis as { [OUTBOX_KEY]?: DevOutbox };
  store[OUTBOX_KEY] ??= new Map();
  return store[OUTBOX_KEY];
}

function outboxKey(kind: AuthEmailKind, address: string): string {
  return `${kind}:${address.trim().toLowerCase()}`;
}

// Only the dev sender writes here, and createAuth refuses the dev sender in production, so this
// is always empty there. Callers must still gate on the environment: the links sign people in.
export function latestDevEmail(
  kind: AuthEmailKind,
  to: string,
): AuthEmail | undefined {
  return devOutbox().get(outboxKey(kind, to));
}

// Dev senders call this so the inbox screens can open the link. Never call it in production:
// the outbox would hold live sign-in links in memory.
export function recordDevEmail(email: AuthEmail): void {
  devOutbox().set(outboxKey(email.kind, email.to), email);
}

// Logs the link (it carries a sign-in token), so createAuth refuses it in production.
export const devConsoleEmailSender: SendAuthEmail = async (email) => {
  recordDevEmail(email);
  console.info(`[auth:email] ${email.kind} → ${email.to}\n  ${email.url}`);
};
