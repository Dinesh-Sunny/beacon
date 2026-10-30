"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { MutationMessage } from "./MutationMessage";
import { useAuthMutation } from "./use-auth-mutation";

// Slugs are unique across every tenant, so a readable part (empty for non-Latin names) gets a
// short random suffix; the slug is never shown, and a clash can't reveal another tenant's name.
const SLUG_SUFFIX_LENGTH = 6;

function slugify(name: string): string {
  const readable = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = crypto.randomUUID().slice(0, SLUG_SUFFIX_LENGTH);
  return readable ? `${readable}-${suffix}` : `org-${suffix}`;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The content unmounts on close, so each opening starts with a fresh form.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CreateOrganizationForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateOrganizationForm({ onDone }: { onDone: () => void }) {
  const [state, create, pending] = useAuthMutation(async (form) => {
    const name = String(form.get("name") ?? "").trim();
    const { data, error } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });
    if (error || !data) return { error };
    const switched = await authClient.organization.setActive({
      organizationId: data.id,
    });
    if (switched.error)
      return { message: `${name} created. Switch to it from the menu.` };
    onDone();
    return { message: `${name} created.` };
  });
  return (
    <form
      onSubmit={submitKeepingValues(create)}
      className="flex flex-col gap-6"
    >
      <DialogHeader>
        <DialogTitle>Create an organization</DialogTitle>
        <DialogDescription>
          Organizations hold a team, its roles, and its API keys. You become its
          owner.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="org-name">Name</FieldLabel>
        <Input
          id="org-name"
          name="name"
          autoComplete="organization"
          required
          aria-describedby="org-name-help"
        />
        <FieldDescription id="org-name-help">
          Your company or team name. You can't rename it here yet.
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
          Create organization
        </Button>
      </DialogFooter>
    </form>
  );
}
