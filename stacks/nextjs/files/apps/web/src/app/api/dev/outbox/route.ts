import { latestDevEmail } from "@__NAME__/auth";
import { AUTH_EMAIL_KINDS, type AuthEmailKind } from "@__NAME__/auth/config";
import type { NextRequest } from "next/server";
import { DEV_OUTBOX_ENABLED } from "@/lib/dev-outbox";

const NOT_FOUND = 404;
// Temporary: the next email to this address replaces the link.
const TEMPORARY_REDIRECT = 307;

function isKind(value: string | null): value is AuthEmailKind {
  return AUTH_EMAIL_KINDS.includes(value as AuthEmailKind);
}

// Dev only: sends the browser to the last ?kind= link emailed to ?to=. See lib/dev-outbox.ts.
export function GET(request: NextRequest): Response {
  if (!DEV_OUTBOX_ENABLED) return new Response(null, { status: NOT_FOUND });
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  const email = isKind(kind)
    ? latestDevEmail(kind, params.get("to") ?? "")
    : undefined;
  if (!email) {
    return new Response(
      "No email for that address yet. Send one, then try again.",
      { status: NOT_FOUND, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.redirect(email.url, TEMPORARY_REDIRECT);
}
