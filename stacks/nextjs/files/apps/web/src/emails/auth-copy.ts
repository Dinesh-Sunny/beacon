import type { AuthEmail } from "@__NAME__/auth";
import {
  INVITATION_EXPIRES_IN_SECONDS,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  PASSWORD_POLICY,
} from "@__NAME__/auth/config";
import { formatDuration } from "@/lib/format";
import { roleListLabel } from "@/lib/org-roles";
import { SITE } from "@/lib/site";
import type { ActionEmailCopy } from "./ActionEmail";

// Inviter and organization names are typed by any user. They stay out of the subject and inbox
// preview (our domain shouldn't carry someone else's words where a phishing line would land),
// and in the body they are flattened to one line and capped.
const MAX_NAME_LENGTH = 60;
// Control characters and invisible format characters, including the bidi overrides that can
// reorder displayed text.
const UNSAFE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

function displayName(value: string): string {
  const single = value
    .replace(UNSAFE_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return single.length > MAX_NAME_LENGTH
    ? `${single.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…`
    : single;
}

// Words for every auth email, next to the auth config they describe.
export function authEmailCopy(email: AuthEmail): ActionEmailCopy {
  switch (email.kind) {
    case "verify-email":
      return {
        subject: `Confirm your email for ${SITE.name}`,
        preview: "One click and your account is ready.",
        heading: "Confirm your email",
        paragraphs: [
          `Confirm this address to finish setting up your ${SITE.name} account. You'll be signed in right after.`,
        ],
        action: "Confirm email",
        footnote:
          "Didn't sign up? Ignore this email and the account stays inactive.",
      };
    case "reset-password": {
      const window = formatDuration(PASSWORD_POLICY.resetLinkExpiresInSeconds);
      return {
        subject: `Reset your ${SITE.name} password`,
        preview: `The link works for ${window}.`,
        heading: "Reset your password",
        paragraphs: [
          `Someone asked to reset the password for this email. The link works for ${window}.`,
          "Choosing a new password signs you out on every other device.",
        ],
        action: "Choose a new password",
        footnote:
          "Didn't ask for this? Ignore this email. Your password stays the same.",
      };
    }
    case "magic-link": {
      const window = formatDuration(MAGIC_LINK_EXPIRES_IN_SECONDS);
      return {
        subject: `Your sign-in link for ${SITE.name}`,
        preview: `It works once and expires in ${window}.`,
        heading: `Sign in to ${SITE.name}`,
        paragraphs: [
          `Use this link to sign in. It works once and expires in ${window}.`,
        ],
        action: "Sign in",
        footnote:
          "Didn't try to sign in? Ignore this email. The link expires on its own.",
      };
    }
    case "org-invitation": {
      const inviter = displayName(email.invitation.inviterName);
      const organization = displayName(email.invitation.organizationName);
      const role = roleListLabel(email.invitation.role).toLowerCase();
      const window = formatDuration(INVITATION_EXPIRES_IN_SECONDS);
      return {
        subject: `You're invited to join a team on ${SITE.name}`,
        preview: `The invitation expires in ${window}.`,
        heading: `Join ${organization}`,
        paragraphs: [
          `${inviter} invited you to join ${organization} on ${SITE.name} as ${role}.`,
          `The invitation expires in ${window}. You can sign in or create an account when you accept.`,
        ],
        action: "Accept invitation",
        footnote: "Not expecting this? Ignore it and nothing changes.",
      };
    }
    case "account-exists":
      return {
        subject: `You already have a ${SITE.name} account`,
        preview: "Sign in instead, or reset your password.",
        heading: "You already have an account",
        paragraphs: [
          "Someone tried to sign up with this email, but it already has an account.",
          "Sign in instead. Forgot your password? Reset it from the sign-in screen.",
        ],
        action: "Sign in",
        footnote:
          "If this wasn't you, nothing changed and you don't need to do anything.",
      };
  }
}
