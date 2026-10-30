import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { TwoFactorChallengeForm } from "@/components/auth/TwoFactorChallengeForm";
import { AUTH_ROUTES, safeNextPath } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Two-factor check",
  path: AUTH_ROUTES.twoFactor,
  noIndex: true,
});

async function TwoFactor({ searchParams }: PageProps<"/two-factor">) {
  const params = await searchParams;
  return (
    <AuthShell>
      <AuthHeading
        title="Enter your code"
        description="Open your authenticator app."
      />
      <TwoFactorChallengeForm next={safeNextPath(params.next)} />
    </AuthShell>
  );
}

export default function TwoFactorPage(props: PageProps<"/two-factor">) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <TwoFactor {...props} />
    </Suspense>
  );
}
