import { isAPIError } from "better-auth/api";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { OrgAvatar } from "@/components/account/OrgAvatar";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { InvitationActions } from "@/components/auth/InvitationActions";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth";
import { AUTH_ROUTES, invitationPath, withNext } from "@/lib/auth-routes";
import { NO_INDEX } from "@/lib/metadata";
import { roleLabel } from "@/lib/org-roles";
import { getSession } from "@/lib/session";

// Per-invitation URLs have no canonical, so this sets title and robots directly.
export const metadata: Metadata = {
  title: "Join an organization",
  robots: NO_INDEX,
};

const INVITE_STEPS = ["Sign in", "Join"] as const;
const SERVER_ERROR_STATUS = 500;

async function AcceptInvitation({
  params,
}: PageProps<"/accept-invitation/[id]">) {
  const { id } = await params;
  const here = invitationPath(id);
  const session = await getSession();

  if (!session) {
    return (
      <AuthShell steps={INVITE_STEPS} currentStep={0}>
        <AuthHeading
          title="You're invited"
          description="Sign in or sign up with the invited email to accept."
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="pointer-coarse:min-h-11">
            <Link href={withNext(AUTH_ROUTES.signIn, here)}>Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="pointer-coarse:min-h-11">
            <Link href={withNext(AUTH_ROUTES.signUp, here)}>
              Create account
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  // A 4xx means missing, expired, or addressed to another email; anything else (database or
  // network) is a real failure for the error boundary.
  const requestHeaders = await headers();
  const invitation = await getAuth()
    .api.getInvitation({ headers: requestHeaders, query: { id } })
    .catch((error: unknown) => {
      if (isAPIError(error) && error.statusCode < SERVER_ERROR_STATUS)
        return null;
      throw error;
    });

  if (!invitation) {
    return (
      <AuthShell steps={INVITE_STEPS} currentStep={1}>
        <AuthHeading
          title="This invitation isn't available"
          description={`It may have expired, been cancelled, or been sent to an email other than ${session.user.email}. Ask the person who invited you to send a new one.`}
        />
        <Button
          asChild
          variant="outline"
          className="self-start pointer-coarse:min-h-11"
        >
          <Link href={AUTH_ROUTES.account}>Go to your account</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell steps={INVITE_STEPS} currentStep={1}>
      <AuthHeading
        media={<OrgAvatar name={invitation.organizationName} size="lg" />}
        title={`Join ${invitation.organizationName}`}
        description={`${invitation.inviterEmail} invited you as ${roleLabel(invitation.role).toLowerCase()}.`}
      />
      <InvitationActions invitationId={invitation.id} />
    </AuthShell>
  );
}

export default function AcceptInvitationPage(
  props: PageProps<"/accept-invitation/[id]">,
) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <AcceptInvitation {...props} />
    </Suspense>
  );
}
