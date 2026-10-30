import { AUTH_ROUTES } from "@/lib/auth-routes";

// Plain module (no "use client"): server pages and client forms both import these, and values
// exported from a client module reach server components as references, not data.
export const SIGN_UP_STEPS = [
  "Your details",
  "Password",
  "Confirm email",
  "Done",
] as const;

export const VERIFIED_CALLBACK = `${AUTH_ROUTES.verifyEmail}?status=verified`;

// Where the confirmation link lands, carrying the page the visitor was headed to.
export function verifiedCallback(next?: string): string {
  return next
    ? `${VERIFIED_CALLBACK}&next=${encodeURIComponent(next)}`
    : VERIFIED_CALLBACK;
}

export const TOTP_CODE_LENGTH = 6;

// After sending an email link, the resend button waits this long (the server rate-limits too).
export const RESEND_COOLDOWN_SECONDS = 60;

// Inline text links on auth and account screens: one definition, themed focus ring included.
const LINK_FOCUS =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export const TEXT_LINK = `font-medium text-foreground underline underline-offset-4 ${LINK_FOCUS}`;
export const MUTED_LINK = `text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline ${LINK_FOCUS}`;

// Auth forms are one task per screen, so their fields and main buttons get a roomier touch size.
export const AUTH_FIELD = "h-11";
export const AUTH_SUBMIT = "h-11";
// The arrow on "Continue" nudges forward on hover; the button already names the action.
export const NEXT_ARROW =
  "transition-transform duration-200 group-hover/button:translate-x-0.5 motion-reduce:transition-none";
