"use client";

import { PASSWORD_POLICY } from "@__NAME__/auth/config";
import { useState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { FormCard } from "./FormCard";
import { useAuthMutation } from "./use-auth-mutation";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [state, change, pending] = useAuthMutation(async (form) => {
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("current") ?? ""),
      newPassword: String(form.get("new") ?? ""),
      revokeOtherSessions: form.get("signOutOthers") === "on",
    });
    // The form resets itself; the controlled new-password field and its meter don't.
    if (!error) setPassword("");
    return { error, message: "Password changed." };
  });

  return (
    <FormCard
      title="Password"
      description="Change it any time. We check new passwords against known data breaches."
      action={change}
      state={state}
      pending={pending}
      submitLabel="Change password"
      keepValues={false}
    >
      <FieldGroup className="max-w-sm">
        <Field>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <PasswordInput
            id="current-password"
            name="current"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <PasswordInput
            id="new-password"
            name="new"
            autoComplete="new-password"
            minLength={PASSWORD_POLICY.minLength}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="new-password-help"
          />
          <PasswordStrength password={password} id="new-password-help" />
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="sign-out-others" name="signOutOthers" defaultChecked />
          <FieldLabel htmlFor="sign-out-others" className="font-normal">
            Sign out my other devices
          </FieldLabel>
        </Field>
      </FieldGroup>
    </FormCard>
  );
}
