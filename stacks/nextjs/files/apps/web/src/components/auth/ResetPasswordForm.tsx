"use client";

import { PASSWORD_POLICY } from "@__NAME__/auth/config";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { AUTH_FIELD, AUTH_SUBMIT } from "./constants";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrength } from "./PasswordStrength";
import { SuccessNotice } from "./SuccessNotice";
import { useShake } from "./use-steps";

type ResetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done" };

// One field: the show toggle lets people check what they typed, which a confirm field only
// guesses at, and a typo is fixable with another reset.
export function ResetPasswordForm({
  token,
  heading,
}: {
  token: string;
  heading: ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [state, submit, pending] = useActionState(
    async (_previous: ResetState, form: FormData): Promise<ResetState> => {
      const newPassword = String(form.get("password") ?? "");
      const { error } = await authClient.resetPassword({ newPassword, token });
      return error
        ? { status: "error", message: authErrorMessage(error) }
        : { status: "done" };
    },
    { status: "idle" },
  );
  const shake = useShake<HTMLFormElement>(state.status === "error" && state);

  if (state.status === "done") {
    return (
      <SuccessNotice
        title="Password changed"
        description="Other devices are signed out. Sign in with your new password."
      >
        <Button asChild size="lg" className={AUTH_SUBMIT}>
          <Link href={AUTH_ROUTES.signIn}>Sign in</Link>
        </Button>
      </SuccessNotice>
    );
  }

  return (
    <>
      {heading}
      <form
        ref={shake}
        onSubmit={submitKeepingValues(submit)}
        className="flex flex-col gap-6"
      >
        {state.status === "error" && (
          <FormAlert tone="error">{state.message}</FormAlert>
        )}
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={PASSWORD_POLICY.minLength}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="password-help"
            className={AUTH_FIELD}
          />
          <PasswordStrength password={password} id="password-help" />
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className={AUTH_SUBMIT}
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Save password
        </Button>
      </form>
    </>
  );
}
