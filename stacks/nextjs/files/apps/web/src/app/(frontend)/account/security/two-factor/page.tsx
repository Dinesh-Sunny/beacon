import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { TwoFactorSetup } from "@/components/account/TwoFactorSetup";
import { getAccountContext } from "@/lib/account";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Set up two-factor sign-in",
  path: AUTH_ROUTES.twoFactorSetup,
  noIndex: true,
});

async function Setup() {
  const { user } = await getAccountContext(AUTH_ROUTES.twoFactorSetup);
  if (user.twoFactorEnabled) redirect(AUTH_ROUTES.accountSecurity);
  return <TwoFactorSetup />;
}

export default function TwoFactorSetupPage() {
  return (
    <>
      <AccountPageHeader
        title="Set up two-factor sign-in"
        description="Three steps, about a minute. After this, signing in asks for a code from your phone."
      />
      <Suspense fallback={<AccountPageSkeleton />}>
        <Setup />
      </Suspense>
    </>
  );
}
