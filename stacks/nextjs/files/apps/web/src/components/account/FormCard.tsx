"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { MutationMessage } from "./MutationMessage";
import type { MutationState } from "./use-auth-mutation";

// A settings card that is one form: fields, then the save button on the fields' left edge with
// its result beside it. `display: contents` keeps the card's own spacing around the form.
export function FormCard({
  title,
  description,
  action,
  state,
  pending,
  submitLabel,
  children,
  keepValues = true,
}: {
  // Passwords should clear after a submit; names and other fields keep what was typed.
  keepValues?: boolean;
  title: string;
  description: ReactNode;
  action: (form: FormData) => void;
  state: MutationState;
  pending: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form
        {...(keepValues
          ? { onSubmit: submitKeepingValues(action) }
          : { action })}
        className="contents"
      >
        <CardContent className="gap-6">
          {children}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={pending}
              className="pointer-coarse:min-h-11"
            >
              {pending && <Spinner className="motion-reduce:animate-none" />}
              {submitLabel}
            </Button>
            <MutationMessage state={state} />
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
