"use client";

import { PASSWORD_POLICY } from "@__NAME__/auth/config";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES, withNext } from "@/lib/auth-routes";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { AuthHeading, AuthShell } from "./AuthShell";
import {
  AUTH_FIELD,
  AUTH_SUBMIT,
  NEXT_ARROW,
  SIGN_UP_STEPS,
  TEXT_LINK,
  verifiedCallback,
} from "./constants";
import { EmailChip } from "./EmailChip";
import { FormAlert } from "./FormAlert";
import { InboxNotice } from "./InboxNotice";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrength } from "./PasswordStrength";
import { ResendVerification } from "./ResendVerification";
import { StepSwitch } from "./StepSwitch";
import { useFocusOnMount, useShake, useSteps } from "./use-steps";

type SignUpState = { status: "idle" } | { status: "error"; message: string };

type Details = { name: string; email: string };

const STEPS = ["details", "password"] as const;
const TITLES = { details: "Create account", password: "Pick a password" };
// Where the in-page steps sit in SIGN_UP_STEPS; the inbox screen is the step after them.
const INBOX_STEP = STEPS.length;

// Details, then password, then "check your inbox", all on one page: the dots move on, the page
// doesn't change.
export function SignUpFlow({ next }: { next?: string }) {
  const [details, setDetails] = useState<Details>({ name: "", email: "" });
  const { step, index, direction, moved, go } = useSteps(STEPS);

  // Set once the account exists; the flow gives way to the inbox screen.
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <AuthShell steps={SIGN_UP_STEPS} currentStep={INBOX_STEP}>
        <InboxNotice
          email={sentTo}
          kind="verify-email"
          footer={
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Nothing yet? Check spam, or send a new one.
              </p>
              <ResendVerification email={sentTo} next={next} />
            </div>
          }
        >
          Tap the link we sent to{" "}
          <strong className="text-foreground">{sentTo}</strong> to finish.
        </InboxNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell steps={SIGN_UP_STEPS} currentStep={index}>
      <AuthHeading title={TITLES[step]} morph />
      <StepSwitch step={step} direction={direction}>
        {step === "details" ? (
          <DetailsStep
            details={details}
            focus={moved}
            onContinue={(value) => {
              setDetails(value);
              go("password");
            }}
          />
        ) : (
          <PasswordStep
            details={details}
            next={next}
            onSent={setSentTo}
            onChangeEmail={() => go("details")}
          />
        )}
      </StepSwitch>
      <p className="text-sm text-muted-foreground">
        Have an account?{" "}
        <Link href={withNext(AUTH_ROUTES.signIn, next)} className={TEXT_LINK}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function DetailsStep({
  details,
  focus,
  onContinue,
}: {
  details: Details;
  focus: boolean;
  onContinue: (details: Details) => void;
}) {
  useFocusOnMount("name", focus);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onContinue({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={details.name}
            className={AUTH_FIELD}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={details.email}
            className={AUTH_FIELD}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className={AUTH_SUBMIT}>
        Continue
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          strokeWidth={2}
          data-icon="inline-end"
          className={NEXT_ARROW}
        />
      </Button>
    </form>
  );
}

// Its errors live and die with the step, so going back to fix the email starts clean.
function PasswordStep({
  details,
  next,
  onSent,
  onChangeEmail,
}: {
  details: Details;
  next?: string;
  onSent: (email: string) => void;
  onChangeEmail: () => void;
}) {
  const [password, setPassword] = useState("");
  useFocusOnMount("password", true);
  const [state, submit, pending] = useActionState(
    async (_previous: SignUpState, form: FormData): Promise<SignUpState> => {
      const { error } = await authClient.signUp.email({
        name: details.name,
        email: details.email,
        password: String(form.get("password") ?? ""),
        callbackURL: verifiedCallback(next),
      });
      if (error) return { status: "error", message: authErrorMessage(error) };
      onSent(details.email);
      return { status: "idle" };
    },
    { status: "idle" },
  );
  const error = state.status === "error" ? state : undefined;
  const shake = useShake<HTMLFormElement>(error);
  return (
    <>
      <EmailChip
        email={details.email}
        name={details.name}
        onChange={onChangeEmail}
      />
      <form
        ref={shake}
        onSubmit={submitKeepingValues(submit)}
        className="flex flex-col gap-6"
      >
        {error && <FormAlert tone="error">{error.message}</FormAlert>}
        {/* Lets password managers save the new pair against this address. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={details.email}
          readOnly
          hidden
        />
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
          Create account
        </Button>
      </form>
    </>
  );
}
