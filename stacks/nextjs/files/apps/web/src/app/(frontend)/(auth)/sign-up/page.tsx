import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { SignUpFlow } from "@/components/auth/SignUpFlow";
import { AUTH_ROUTES, safeNextPath } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Create your account",
  path: AUTH_ROUTES.signUp,
  noIndex: true,
});

async function SignUp({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  return (
    <SignUpFlow next={params.next ? safeNextPath(params.next) : undefined} />
  );
}

export default function SignUpPage(props: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <SignUp {...props} />
    </Suspense>
  );
}
