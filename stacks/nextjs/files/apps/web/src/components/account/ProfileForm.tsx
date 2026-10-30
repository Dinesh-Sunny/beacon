"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { FormCard } from "./FormCard";
import { useAuthMutation } from "./use-auth-mutation";

export function ProfileForm({ name }: { name: string }) {
  const [state, save, pending] = useAuthMutation(async (form) => {
    const { error } = await authClient.updateUser({
      name: String(form.get("name") ?? "").trim(),
    });
    return { error, message: "Name saved." };
  });

  return (
    <FormCard
      title="Name"
      description="Shown to people in your organizations and on invitations you send."
      action={save}
      state={state}
      pending={pending}
      submitLabel="Save name"
    >
      <Field className="max-w-sm">
        <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          defaultValue={name}
          required
        />
      </Field>
    </FormCard>
  );
}
