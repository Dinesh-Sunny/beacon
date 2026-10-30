import type { AuthEmail } from "@__NAME__/auth";
import { AUTH_EMAIL_KINDS, type AuthEmailKind } from "@__NAME__/auth/config";
import { renderAuthEmail } from "@/emails/render";
import { DEV_OUTBOX_ENABLED } from "@/lib/dev-outbox";
import { absoluteUrl } from "@/lib/site";

const NOT_FOUND = 404;

// Sample data for previews only; never sent. `?sample=hostile` checks how user-typed names hold
// up (length, control characters, bidi overrides).
// Built from code points so no invisible character sits in the source.
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const BELL = String.fromCodePoint(0x07);

const SAMPLE_INVITATIONS = {
  default: {
    organizationName: "Northwind",
    inviterName: "Sam Rivera",
    role: "admin",
  },
  hostile: {
    organizationName: `Northwind${RIGHT_TO_LEFT_OVERRIDE} Security Team, urgent account review required within 24 hours`,
    inviterName: `Sam\nRivera${BELL} (support)`,
    role: "admin,member",
  },
} as const;

function isKind(value: string): value is AuthEmailKind {
  return AUTH_EMAIL_KINDS.includes(value as AuthEmailKind);
}

function sampleEmail(kind: AuthEmailKind, sample: string | null): AuthEmail {
  const base = { to: "preview@example.com", url: absoluteUrl("/preview-link") };
  if (kind !== "org-invitation") return { ...base, kind };
  const invitation =
    sample === "hostile"
      ? SAMPLE_INVITATIONS.hostile
      : SAMPLE_INVITATIONS.default;
  return { ...base, kind, invitation };
}

// Dev only: renders an auth email in the browser, e.g. /api/dev/emails/magic-link (add
// ?format=text for the plain-text part). 404 in production, like the dev outbox.
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/dev/emails/[kind]">,
): Promise<Response> {
  const { kind } = await params;
  if (!DEV_OUTBOX_ENABLED || !isKind(kind)) {
    return new Response(null, { status: NOT_FOUND });
  }
  const search = new URL(request.url).searchParams;
  const message = await renderAuthEmail(
    sampleEmail(kind, search.get("sample")),
  );
  const asText = search.get("format") === "text";
  return new Response(
    asText ? `Subject: ${message.subject}\n\n${message.text}` : message.html,
    {
      headers: {
        "content-type": `${asText ? "text/plain" : "text/html"}; charset=utf-8`,
        "cache-control": "no-store",
      },
    },
  );
}
