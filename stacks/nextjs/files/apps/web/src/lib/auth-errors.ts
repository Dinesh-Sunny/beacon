import {
  BOT_DETECTED_ERROR_CODE,
  SEAT_LIMIT_ERROR_CODE,
  SOLE_OWNER_ERROR_CODE,
} from "@__NAME__/auth/config";

// Better Auth error codes in plain words (VOICE.md: the problem, then the fix). A Map, because
// codes can arrive from the URL (?error=__proto__) and must never reach Object.prototype.
const MESSAGES = new Map<string, string>(
  Object.entries({
    INVALID_EMAIL_OR_PASSWORD:
      "That email and password don't match. Try again, or reset your password.",
    EMAIL_NOT_VERIFIED:
      "Confirm your email first. Use the link we sent, or send a new one.",
    USER_ALREADY_EXISTS:
      "An account with this email already exists. Sign in instead.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
      "An account with this email already exists. Sign in instead.",
    INVALID_EMAIL: "Enter a valid email address.",
    PASSWORD_TOO_SHORT: "Use at least 12 characters.",
    PASSWORD_TOO_LONG: "Use a shorter password.",
    PASSWORD_COMPROMISED:
      "This password has appeared in a data breach. Choose a different one.",
    INVALID_PASSWORD: "That password isn't right.",
    INVALID_TOKEN:
      "This link is invalid or was already used. Request a new one.",
    TOKEN_EXPIRED: "This link has expired. Request a new one.",
    INVALID_CODE:
      "That code isn't right. Check your authenticator app and try again.",
    OTP_HAS_EXPIRED:
      "That code has expired. Enter the current one from your app.",
    INVALID_TWO_FACTOR_COOKIE: "Your sign-in timed out. Sign in again.",
    TOO_MANY_ATTEMPTS: "Too many attempts. Wait a minute, then try again.",
    TOO_MANY_REQUESTS: "Too many attempts. Wait a minute, then try again.",
    SESSION_NOT_FRESH:
      "For your security, sign in again before making this change.",
    USER_NOT_FOUND: "We couldn't find that account.",
    [SEAT_LIMIT_ERROR_CODE]:
      "This organization has no seats left. An owner can upgrade the plan in Billing or remove someone.",
    // From the Stripe plugin's guard on deleting an organization.
    ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION:
      "This organization still has a paid plan. Cancel it in Billing, then delete the organization.",
    [BOT_DETECTED_ERROR_CODE]:
      "We couldn't confirm this came from a person. Reload the page and try again.",
    [SOLE_OWNER_ERROR_CODE]:
      "You're the only owner of an organization with other members. Make someone else an owner first, then delete your account.",
  }),
);

const RATE_LIMITED_STATUS = 429;
const FALLBACK = "Something went wrong. Try again in a moment.";

export type AuthClientError = {
  code?: string;
  status?: number;
  message?: string;
};

export function authErrorMessage(
  error: AuthClientError | null | undefined,
): string {
  if (!error) return FALLBACK;
  if (error.status === RATE_LIMITED_STATUS)
    return MESSAGES.get("TOO_MANY_REQUESTS") ?? FALLBACK;
  return (error.code && MESSAGES.get(error.code)) || error.message || FALLBACK;
}
