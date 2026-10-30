import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { AUTH_SUBMIT, SIGN_UP_STEPS } from "@/components/auth/constants";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { SuccessNotice } from "@/components/auth/SuccessNotice";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES, safeNextPath } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";
import { getSession } from "@/lib/session";

export const metadata: Metadata = pageMetadata({
  title: "Confirm your email",
  path: AUTH_ROUTES.verifyEmail,
  noIndex: true,
});

const CONFIRM_STEP = SIGN_UP_STEPS.indexOf("Confirm email");
const DONE_STEP = SIGN_UP_STEPS.indexOf("Done");

// Landing page for the confirmation link. Better Auth redirects here after checking the token,
// adding ?error=<code> when the link was invalid or expired.
async function VerifyEmail({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  // Confirmation is read from the session, not the URL: anyone can type ?status=verified.
  const session = await getSession();
  const verified = !error && Boolean(session?.user.emailVerified);

  if (!verified) {
    return (
      <AuthShell steps={SIGN_UP_STEPS} currentStep={CONFIRM_STEP}>
        <AuthHeading
          title={error ? "This link didn't work" : "Confirm your email"}
          description={
            error
              ? authErrorMessage({ code: error })
              : "Tap the link we emailed you, or get a new one."
          }
        />
        <ResendVerification />
      </AuthShell>
    );
  }

  return (
    <AuthShell steps={SIGN_UP_STEPS} currentStep={DONE_STEP}>
      <SuccessNotice
        focusOnMount={false}
        title="You're in"
        description="Email confirmed. Your account is ready."
      >
        <Button asChild size="lg" className={AUTH_SUBMIT}>
          <Link href={safeNextPath(params.next)}>Continue</Link>
        </Button>
      </SuccessNotice>
    </AuthShell>
  );
}

export default function VerifyEmailPage(props: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <VerifyEmail {...props} />
    </Suspense>
  );
}
