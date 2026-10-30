"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { announce, focusPageHeading } from "@/lib/announce";
import type { AuthClientError } from "@/lib/auth-errors";
import { MutationMessage } from "./MutationMessage";
import { useAuthMutation } from "./use-auth-mutation";

const PASSWORD_FIELD_ID = "confirm-password";

// Destructive or security-sensitive actions confirm in a dialog and ask for the password, so a
// walked-up-to unlocked laptop can't turn off protection or delete the account.
export function PasswordConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (
    password: string,
  ) => Promise<{ error?: AuthClientError | null; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const confirmed = useRef(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A fresh form each time it opens, so an old error doesn't greet the next try.
        if (next) setAttempt((count) => count + 1);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        // Radix focuses Cancel first; the password is what this dialog needs.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(PASSWORD_FIELD_ID)?.focus();
        }}
        // A confirmed action replaces its trigger, so focus goes to the page heading.
        onCloseAutoFocus={(event) => {
          if (!confirmed.current) return;
          event.preventDefault();
          focusPageHeading();
        }}
      >
        <PasswordConfirmForm
          key={attempt}
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          destructive={destructive}
          onConfirm={onConfirm}
          onConfirmed={(message) => {
            confirmed.current = true;
            if (message) announce(message);
            setOpen(false);
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PasswordConfirmForm({
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onConfirmed,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirmed: (message?: string) => void;
  onConfirm: (
    password: string,
  ) => Promise<{ error?: AuthClientError | null; message?: string }>;
}) {
  const [state, confirm, pending] = useAuthMutation(async (form) => {
    const result = await onConfirm(String(form.get("password") ?? ""));
    if (!result.error) onConfirmed(result.message);
    return result;
  });
  return (
    <form action={confirm} className="flex flex-col gap-4">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <Field>
        <FieldLabel htmlFor={PASSWORD_FIELD_ID}>Password</FieldLabel>
        <PasswordInput
          id={PASSWORD_FIELD_ID}
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <MutationMessage state={state} />
      <AlertDialogFooter>
        <AlertDialogCancel type="button" className="pointer-coarse:min-h-11">
          Cancel
        </AlertDialogCancel>
        <Button
          type="submit"
          variant={destructive ? "destructive" : "default"}
          disabled={pending}
          className="pointer-coarse:min-h-11"
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
