import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { AUTH_SUBMIT } from "@/components/auth/constants";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Choose a new password",
  path: AUTH_ROUTES.resetPassword,
  noIndex: true,
});

// The reset email links through Better Auth, which redirects here with ?token=... or ?error=...
async function ResetPassword({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  if (!token || error) {
    return (
      <AuthShell>
        <AuthHeading
          title="This link didn't work"
          description={authErrorMessage({ code: error ?? "INVALID_TOKEN" })}
        />
        <Button asChild size="lg" className={cn("self-start", AUTH_SUBMIT)}>
          <Link href={AUTH_ROUTES.forgotPassword}>Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ResetPasswordForm
        token={token}
        heading={<AuthHeading title="Pick a new password" />}
      />
    </AuthShell>
  );
}

export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ResetPassword {...props} />
    </Suspense>
  );
}
