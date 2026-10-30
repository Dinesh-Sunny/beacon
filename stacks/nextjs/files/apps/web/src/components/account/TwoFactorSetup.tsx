"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { TOTP_CODE_LENGTH } from "@/components/auth/constants";
import { FormAlert } from "@/components/auth/FormAlert";
import { OtpField } from "@/components/auth/OtpField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { StepProgress } from "@/components/auth/StepProgress";
import { SuccessNotice } from "@/components/auth/SuccessNotice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { CopyButton } from "./CopyButton";

const STEPS = ["Confirm password", "Scan code", "Save backup codes"] as const;

type SetupState =
  | { step: 0; error?: string }
  | {
      step: 1;
      totpURI: string;
      backupCodes: string[];
      error?: string;
      attempt: number;
    }
  | { step: 2; backupCodes: string[] };

// The secret printed under the QR code for people who can't scan.
function secretFrom(totpURI: string): string {
  return new URL(totpURI).searchParams.get("secret") ?? "";
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="ml-auto pointer-coarse:min-h-11"
    >
      {pending && <Spinner className="motion-reduce:animate-none" />}
      {label}
    </Button>
  );
}

export function TwoFactorSetup() {
  const [state, advance, pending] = useActionState(
    async (previous: SetupState, form: FormData): Promise<SetupState> => {
      if (previous.step === 0) {
        const { data, error } = await authClient.twoFactor.enable({
          password: String(form.get("password") ?? ""),
        });
        if (error || !data) return { step: 0, error: authErrorMessage(error) };
        // We only configure TOTP; the email-OTP variant carries no secret to scan.
        if (data.method !== "totp")
          return { step: 0, error: authErrorMessage(null) };
        return {
          step: 1,
          totpURI: data.totpURI,
          backupCodes: data.backupCodes,
          attempt: 0,
        };
      }
      if (previous.step === 1) {
        const { error } = await authClient.twoFactor.verifyTotp({
          code: String(form.get("code") ?? "").replace(/\s/g, ""),
        });
        if (error)
          return {
            ...previous,
            error: authErrorMessage(error),
            attempt: previous.attempt + 1,
          };
        return { step: 2, backupCodes: previous.backupCodes };
      }
      return previous;
    },
    { step: 0 } as SetupState,
  );

  // Each step replaces the last; focus follows to its heading so keyboard users aren't dropped
  // back to the top of the page (WCAG 2.4.3).
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.step > 0) stepHeading.current?.focus();
  }, [state.step]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <StepProgress steps={STEPS} current={state.step} />
      {state.step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Confirm it's you</h2>
            </CardTitle>
            <CardDescription>
              You'll need an authenticator app on your phone, such as 1Password,
              Google Authenticator, or Authy.
            </CardDescription>
          </CardHeader>
          <form action={advance} className="contents">
            <CardContent className="gap-4">
              {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
              <Field className="max-w-sm">
                <FieldLabel htmlFor="setup-password">Password</FieldLabel>
                <PasswordInput
                  id="setup-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  aria-describedby="setup-password-help"
                />
                <FieldDescription id="setup-password-help">
                  Two-factor stays off until you confirm a code in the next
                  step.
                </FieldDescription>
              </Field>
            </CardContent>
            <CardFooter className="gap-3 border-t">
              <Button
                asChild
                variant="ghost"
                className="pointer-coarse:min-h-11"
              >
                <Link href={AUTH_ROUTES.accountSecurity}>Cancel</Link>
              </Button>
              <SubmitButton pending={pending} label="Continue" />
            </CardFooter>
          </form>
        </Card>
      )}

      {state.step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 ref={stepHeading} tabIndex={-1} className="outline-none">
                Scan this code
              </h2>
            </CardTitle>
            <CardDescription>
              Scan it with your authenticator app, then enter the{" "}
              {TOTP_CODE_LENGTH}-digit code it shows.
            </CardDescription>
          </CardHeader>
          <form action={advance} className="contents">
            <CardContent className="gap-6">
              <div className="flex flex-col items-start gap-6 sm:flex-row">
                {/* QR codes need a light quiet zone to scan, whatever the theme. */}
                <div className="shrink-0 rounded-xl border bg-background p-4">
                  <QRCode
                    value={state.totpURI}
                    size={168}
                    level="M"
                    aria-label="QR code for your authenticator app"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Can't scan? Enter this key in the app instead.
                  </p>
                  <code className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                    {secretFrom(state.totpURI)}
                  </code>
                  <CopyButton
                    value={secretFrom(state.totpURI)}
                    label="Copy key"
                  />
                </div>
              </div>
              {state.error && (
                <FormAlert tone="error" id="setup-code-error">
                  {state.error}
                </FormAlert>
              )}
              <Field>
                <FieldLabel htmlFor="setup-code">
                  {TOTP_CODE_LENGTH}-digit code
                </FieldLabel>
                <OtpField
                  key={state.attempt}
                  id="setup-code"
                  disabled={pending}
                  invalid={Boolean(state.error)}
                  describedBy={state.error ? "setup-code-error" : undefined}
                />
              </Field>
            </CardContent>
            <CardFooter className="border-t">
              <SubmitButton pending={pending} label="Turn on two-factor" />
            </CardFooter>
          </form>
        </Card>
      )}

      {state.step === 2 && (
        <Card>
          <CardContent className="gap-6">
            <SuccessNotice
              level={2}
              title="Two-factor sign-in is on"
              description="Save these backup codes. Each works once if you lose your phone. Keep them somewhere safe, like a password manager."
            />
            <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm tabular-nums">
              {state.backupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="gap-3 border-t">
            <CopyButton
              value={state.backupCodes.join("\n")}
              label="Copy codes"
            />
            <Button asChild className="ml-auto pointer-coarse:min-h-11">
              <Link href={AUTH_ROUTES.accountSecurity}>Done</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
