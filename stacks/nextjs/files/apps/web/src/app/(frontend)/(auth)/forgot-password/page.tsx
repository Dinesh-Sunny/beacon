import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { TEXT_LINK } from "@/components/auth/constants";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Reset your password",
  path: AUTH_ROUTES.forgotPassword,
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm
        heading={
          <AuthHeading
            title="Forgot your password?"
            description="We'll email you a link to pick a new one."
          />
        }
      />
      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href={AUTH_ROUTES.signIn} className={TEXT_LINK}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
