import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { TEXT_LINK } from "@/components/auth/constants";
import { SignInForm } from "@/components/auth/SignInForm";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES, safeNextPath, withNext } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  path: AUTH_ROUTES.signIn,
  noIndex: true,
});

async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  // A sign-in link that failed redirects back here with ?error=<code>.
  const linkError = typeof params.error === "string" ? params.error : undefined;
  return (
    <AuthShell>
      <SignInForm
        next={next}
        linkError={
          linkError ? authErrorMessage({ code: linkError }) : undefined
        }
      />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={withNext(AUTH_ROUTES.signUp, params.next ? next : undefined)}
          className={TEXT_LINK}
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <SignIn {...props} />
    </Suspense>
  );
}
