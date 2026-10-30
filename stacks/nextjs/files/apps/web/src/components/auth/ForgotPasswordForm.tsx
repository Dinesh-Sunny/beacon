"use client";

import { PASSWORD_POLICY } from "@__NAME__/auth/config";
import { type ReactNode, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDuration } from "@/lib/format";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { AUTH_FIELD, AUTH_SUBMIT } from "./constants";
import { FormAlert } from "./FormAlert";
import { InboxNotice } from "./InboxNotice";
import { useShake } from "./use-steps";

type ForgotState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; email: string };

export function ForgotPasswordForm({ heading }: { heading: ReactNode }) {
  const [state, submit, pending] = useActionState(
    async (_previous: ForgotState, form: FormData): Promise<ForgotState> => {
      const email = String(form.get("email") ?? "").trim();
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: AUTH_ROUTES.resetPassword,
      });
      return error
        ? { status: "error", message: authErrorMessage(error) }
        : { status: "sent", email };
    },
    { status: "idle" },
  );
  const shake = useShake<HTMLFormElement>(state.status === "error" && state);

  // Same message whether or not the account exists, so the form can't be used to probe emails.
  if (state.status === "sent") {
    return (
      <InboxNotice email={state.email} kind="reset-password">
        If <strong className="text-foreground">{state.email}</strong> has an
        account, a reset link is on its way. It lasts{" "}
        {formatDuration(PASSWORD_POLICY.resetLinkExpiresInSeconds)}.
      </InboxNotice>
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
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={AUTH_FIELD}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className={AUTH_SUBMIT}
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Send reset link
        </Button>
      </form>
    </>
  );
}
