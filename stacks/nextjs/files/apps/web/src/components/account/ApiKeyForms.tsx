"use client";

import { API_KEY_PREFIX } from "@__NAME__/auth/config";
import { Delete02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { announce, focusPageHeading } from "@/lib/announce";
import { authClient } from "@/lib/auth-client";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { CopyButton } from "./CopyButton";
import { MutationMessage } from "./MutationMessage";
import { useAuthMutation } from "./use-auth-mutation";

export function CreateApiKeyDialog({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAttempt((count) => count + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button className="pointer-coarse:min-h-11">
          <HugeiconsIcon
            icon={PlusSignIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Create key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <CreateApiKeyForm
          key={attempt}
          organizationId={organizationId}
          organizationName={organizationName}
        />
      </DialogContent>
    </Dialog>
  );
}

// Two states in one dialog: name the key, then show it once with a copy button.
function CreateApiKeyForm({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [state, create, pending] = useAuthMutation(async (form) => {
    const { data, error } = await authClient.apiKey.create({
      name: String(form.get("name") ?? "").trim(),
      organizationId,
    });
    if (data) setCreatedKey(data.key);
    return { error };
  });

  if (createdKey) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <DialogHeader>
          <DialogTitle>Copy your new key</DialogTitle>
          <DialogDescription>
            This is the only time it's shown. Store it in your secrets manager
            now.
          </DialogDescription>
        </DialogHeader>
        <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-sm break-all">
          {createdKey}
        </code>
        <DialogFooter>
          <CopyButton value={createdKey} label="Copy key" />
          <DialogClose asChild>
            <Button className="pointer-coarse:min-h-11">Done</Button>
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitKeepingValues(create)}
      className="flex flex-col gap-6"
    >
      <DialogHeader>
        <DialogTitle>Create an API key</DialogTitle>
        <DialogDescription>
          For servers and scripts acting for {organizationName}. Keys start with{" "}
          <code className="font-mono">{API_KEY_PREFIX}</code>.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="key-name">Key name</FieldLabel>
        <Input
          id="key-name"
          name="name"
          autoComplete="off"
          required
          aria-describedby="key-name-help"
        />
        <FieldDescription id="key-name-help">
          Where it's used, such as "Billing sync".
        </FieldDescription>
      </Field>
      <MutationMessage state={state} />
      <DialogFooter>
        <Button
          type="submit"
          disabled={pending}
          className="pointer-coarse:min-h-11"
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Create key
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteApiKeyButton({
  keyId,
  name,
}: {
  keyId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const deleted = useRef(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${name}`}
          className="text-muted-foreground hover:text-destructive pointer-coarse:size-11"
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        // The trigger's row is about to disappear, so focus goes to the page heading instead.
        onCloseAutoFocus={(event) => {
          if (!deleted.current) return;
          event.preventDefault();
          focusPageHeading();
        }}
      >
        {/* Content unmounts on close, so each opening starts without the last error. */}
        <DeleteApiKeyForm
          keyId={keyId}
          name={name}
          onDeleted={() => {
            deleted.current = true;
            setOpen(false);
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteApiKeyForm({
  keyId,
  name,
  onDeleted,
}: {
  keyId: string;
  name: string;
  onDeleted: () => void;
}) {
  const [state, remove, pending] = useAuthMutation(async () => {
    const { error } = await authClient.apiKey.delete({ keyId });
    if (!error) {
      announce(`${name} deleted.`);
      onDeleted();
    }
    return { error, message: `${name} deleted.` };
  });
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Anything using this key stops working right away. This can't be
          undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <MutationMessage state={state} />
      <AlertDialogFooter>
        <AlertDialogCancel className="pointer-coarse:min-h-11">
          Keep key
        </AlertDialogCancel>
        {/* A plain submit (not AlertDialogAction) so the dialog stays open until the request ends. */}
        <form action={remove}>
          <Button
            type="submit"
            variant="destructive"
            disabled={pending}
            className="w-full pointer-coarse:min-h-11"
          >
            {pending && <Spinner className="motion-reduce:animate-none" />}
            Delete key
          </Button>
        </form>
      </AlertDialogFooter>
    </>
  );
}
