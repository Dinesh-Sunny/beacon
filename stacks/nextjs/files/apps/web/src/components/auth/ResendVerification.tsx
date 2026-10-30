"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";
import { RESEND_COOLDOWN_SECONDS, verifiedCallback } from "./constants";
import { useCooldown } from "./use-cooldown";

type ResendState =
  | { status: "idle" | "sent" }
  | { status: "error"; message: string };

// Sends a fresh confirmation link, then waits before allowing another. Without a known address
// it asks for one first.
export function ResendVerification({
  email,
  next,
  className,
}: {
  email?: string;
  // The page the visitor was headed to (an invitation, say), kept through the new link.
  next?: string;
  className?: string;
}) {
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS);
  const [state, resend, pending] = useActionState(
    async (_previous: ResendState, form: FormData): Promise<ResendState> => {
      const address = email ?? String(form.get("email") ?? "").trim();
      const { error } = await authClient.sendVerificationEmail({
        email: address,
        callbackURL: verifiedCallback(next),
      });
      if (error) return { status: "error", message: authErrorMessage(error) };
      cooldown.start();
      return { status: "sent" };
    },
    { status: "idle" } as ResendState,
  );

  return (
    <form action={resend} className={cn("flex flex-col gap-2", className)}>
      {!email && (
        <Field>
          <FieldLabel htmlFor="resend-email">Email</FieldLabel>
          <Input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={pending || cooldown.left > 0}
        className="pointer-coarse:min-h-11"
      >
        {pending && <Spinner className="motion-reduce:animate-none" />}
        {cooldown.left > 0
          ? `Send again in ${cooldown.left}s`
          : "Send a new link"}
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {state.status === "sent" &&
          (email
            ? `A new link is on its way to ${email}.`
            : "If that account exists, a new link is on its way.")}
        {state.status === "error" && state.message}
      </p>
    </form>
  );
}
