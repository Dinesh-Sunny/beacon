"use client";

import { MAGIC_LINK_EXPIRES_IN_SECONDS } from "@__NAME__/auth/config";
import { ArrowRight02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES, withNext } from "@/lib/auth-routes";
import { formatDuration } from "@/lib/format";
import { AuthHeading } from "./AuthHeading";
import { AUTH_FIELD, AUTH_SUBMIT, MUTED_LINK, NEXT_ARROW } from "./constants";
import { EmailChip } from "./EmailChip";
import { FormAlert } from "./FormAlert";
import { InboxNotice } from "./InboxNotice";
import { PasswordInput } from "./PasswordInput";
import { ResendVerification } from "./ResendVerification";
import { StepSwitch } from "./StepSwitch";
import { useFocusOnMount, useShake, useSteps } from "./use-steps";

type SignInState =
  | { status: "idle" }
  | { status: "error"; message: string; unverifiedEmail?: string };

const IDLE: SignInState = { status: "idle" };
const STEPS = ["email", "password"] as const;
const TITLES = { email: "Sign in", password: "Welcome back" } as const;

export function SignInForm({
  next,
  linkError,
}: {
  next: Route;
  // A sign-in link that failed lands back here with a message for the first step.
  linkError?: string;
}) {
  // "Use a different email" remounts the flow, clearing the sent state.
  const [attempt, setAttempt] = useState(0);
  return (
    <SignInSteps
      key={attempt}
      next={next}
      linkError={attempt === 0 ? linkError : undefined}
      restarted={attempt > 0}
      onRestart={() => setAttempt((count) => count + 1)}
    />
  );
}

// Email first, then the password (or a link instead). One field at a time.
function SignInSteps({
  next,
  linkError,
  restarted,
  onRestart,
}: {
  next: Route;
  linkError?: string;
  // After "Use a different email" the button that held focus is gone; focus the field instead.
  restarted: boolean;
  onRestart: () => void;
}) {
  const [email, setEmail] = useState("");
  const { step, direction, moved, go } = useSteps(STEPS);

  // Set once a sign-in link is sent; the flow gives way to the inbox screen.
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <InboxNotice
        email={sentTo}
        kind="magic-link"
        footer={
          <Button
            variant="link"
            className="self-start px-0 pointer-coarse:min-h-11"
            onClick={onRestart}
          >
            Use a different email
          </Button>
        }
      >
        A sign-in link is on its way to{" "}
        <strong className="text-foreground">{sentTo}</strong>. It works once,
        for {formatDuration(MAGIC_LINK_EXPIRES_IN_SECONDS)}.
      </InboxNotice>
    );
  }

  return (
    <>
      <AuthHeading title={TITLES[step]} morph />
      <StepSwitch step={step} direction={direction}>
        {step === "email" ? (
          <EmailStep
            email={email}
            // The failed-link message belongs to the arrival, not to a later trip back.
            error={moved ? undefined : linkError}
            focus={moved || restarted}
            onContinue={(address) => {
              setEmail(address);
              go("password");
            }}
          />
        ) : (
          <PasswordStep
            email={email}
            next={next}
            onLinkSent={setSentTo}
            onChangeEmail={() => go("email")}
          />
        )}
      </StepSwitch>
    </>
  );
}

function EmailStep({
  email,
  error,
  focus,
  onContinue,
}: {
  email: string;
  error?: string;
  focus: boolean;
  onContinue: (email: string) => void;
}) {
  useFocusOnMount("email", focus);
  // Browser validation runs before submit fires, so the address is well formed here.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onContinue(String(form.get("email") ?? "").trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username webauthn"
          required
          defaultValue={email}
          className={AUTH_FIELD}
        />
      </Field>
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

// Its errors live and die with the step, so going back to change the email starts clean.
function PasswordStep({
  email,
  next,
  onLinkSent,
  onChangeEmail,
}: {
  email: string;
  next: Route;
  onLinkSent: (email: string) => void;
  onChangeEmail: () => void;
}) {
  const router = useRouter();
  useFocusOnMount("password", true);

  const [linkState, sendLink, sendingLink] = useActionState(
    async (_previous: SignInState): Promise<SignInState> => {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: next,
        newUserCallbackURL: next,
        errorCallbackURL: withNext(AUTH_ROUTES.signIn, next),
      });
      if (error) return { status: "error", message: authErrorMessage(error) };
      onLinkSent(email);
      return IDLE;
    },
    IDLE,
  );

  const [state, signIn, signingIn] = useActionState(
    async (_previous: SignInState, form: FormData): Promise<SignInState> => {
      const { data, error } = await authClient.signIn.email({
        email,
        password: String(form.get("password") ?? ""),
      });
      if (error) {
        return {
          status: "error",
          message: authErrorMessage(error),
          unverifiedEmail:
            error.code === "EMAIL_NOT_VERIFIED" ? email : undefined,
        };
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        router.push(withNext(AUTH_ROUTES.twoFactor, next));
        return IDLE;
      }
      router.push(next);
      router.refresh();
      return IDLE;
    },
    IDLE,
  );
  const shake = useShake<HTMLFormElement>(state.status === "error" && state);

  return (
    <>
      <EmailChip email={email} onChange={onChangeEmail} />
      {/* The resend control is its own form, so it sits outside the sign-in form. */}
      {state.status === "error" && (
        <div className="flex flex-col gap-3">
          <FormAlert tone="error">{state.message}</FormAlert>
          {state.unverifiedEmail && (
            <ResendVerification email={state.unverifiedEmail} />
          )}
        </div>
      )}
      <form ref={shake} action={signIn} className="flex flex-col gap-6">
        {/* Lets password managers save the pair even though the email step has gone. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href={AUTH_ROUTES.forgotPassword} className={MUTED_LINK}>
              Forgot it?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={state.status === "error" || undefined}
            className={AUTH_FIELD}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={signingIn}
          className={AUTH_SUBMIT}
        >
          {signingIn && <Spinner className="motion-reduce:animate-none" />}
          Sign in
        </Button>
      </form>
      <FieldSeparator>or</FieldSeparator>
      <form action={sendLink} className="flex flex-col gap-3">
        {linkState.status === "error" && (
          <FormAlert tone="error">{linkState.message}</FormAlert>
        )}
        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={sendingLink}
          className={AUTH_SUBMIT}
        >
          {sendingLink ? (
            <Spinner className="motion-reduce:animate-none" />
          ) : (
            <HugeiconsIcon
              icon={Mail01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
          )}
          Email me a link instead
        </Button>
      </form>
    </>
  );
}
