"use client";

import { TRUSTED_DEVICE_MAX_AGE_SECONDS } from "@__NAME__/auth/config";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES, withNext } from "@/lib/auth-routes";
import { formatDuration } from "@/lib/format";
import {
  AUTH_FIELD,
  AUTH_SUBMIT,
  TEXT_LINK,
  TOTP_CODE_LENGTH,
} from "./constants";
import { FormAlert } from "./FormAlert";
import { OtpField } from "./OtpField";
import { useShake } from "./use-steps";

const EXPIRED_CHALLENGE_CODE = "INVALID_TWO_FACTOR_COOKIE";

type ChallengeState =
  | { status: "idle" }
  | { status: "error"; message: string; attempt: number; expired: boolean };

export function TwoFactorChallengeForm({ next }: { next: Route }) {
  const router = useRouter();
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [state, submit, pending] = useActionState(
    async (
      previous: ChallengeState,
      form: FormData,
    ): Promise<ChallengeState> => {
      const code = String(form.get("code") ?? "").replace(/\s/g, "");
      const trustDevice = form.get("trust") === "on";
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice });
      if (error) {
        const attempt = previous.status === "error" ? previous.attempt + 1 : 1;
        return {
          status: "error",
          message: authErrorMessage(error),
          attempt,
          // The challenge cookie lapsed: a code can't help, only signing in again.
          expired: error.code === EXPIRED_CHALLENGE_CODE,
        };
      }
      router.push(next);
      router.refresh();
      return { status: "idle" };
    },
    { status: "idle" },
  );

  // A wrong code clears the slots (new key per attempt) so the next code types in fresh.
  const attempt = state.status === "error" ? state.attempt : 0;
  const shake = useShake<HTMLDivElement>(state.status === "error" && state);

  return (
    <form action={submit} className="flex flex-col gap-8">
      {state.status === "error" && (
        <FormAlert tone="error" id="code-error">
          {state.message}
          {state.expired && (
            <>
              {" "}
              <Link
                href={withNext(AUTH_ROUTES.signIn, next)}
                className={TEXT_LINK}
              >
                Sign in again
              </Link>
            </>
          )}
        </FormAlert>
      )}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="code" className={useBackupCode ? "" : "sr-only"}>
            {useBackupCode ? "Backup code" : `${TOTP_CODE_LENGTH}-digit code`}
          </FieldLabel>
          <div ref={shake}>
            {useBackupCode ? (
              <Input
                key="backup"
                id="code"
                name="code"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={state.status === "error" || undefined}
                aria-describedby={
                  state.status === "error"
                    ? "code-error code-help"
                    : "code-help"
                }
                className={`font-mono ${AUTH_FIELD}`}
              />
            ) : (
              <OtpField
                key={`totp-${attempt}`}
                id="code"
                disabled={pending}
                invalid={state.status === "error"}
                describedBy={
                  state.status === "error"
                    ? "code-error code-help"
                    : "code-help"
                }
              />
            )}
          </div>
          <FieldDescription id="code-help">
            {useBackupCode
              ? "One you saved when you turned on two-factor. Each works once."
              : "It sends itself once the last digit is in."}
          </FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Switch id="trust" name="trust" />
          <FieldLabel htmlFor="trust" className="font-normal">
            Remember this device for{" "}
            {formatDuration(TRUSTED_DEVICE_MAX_AGE_SECONDS)}
          </FieldLabel>
        </Field>
      </FieldGroup>
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className={AUTH_SUBMIT}
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Verify
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => setUseBackupCode((value) => !value)}
          className="self-start px-0 pointer-coarse:min-h-11"
        >
          {useBackupCode ? "Use authenticator code" : "Use a backup code"}
        </Button>
      </div>
    </form>
  );
}
