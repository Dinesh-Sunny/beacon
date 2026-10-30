"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { MutationMessage } from "./MutationMessage";
import { useAuthMutation } from "./use-auth-mutation";

export function SignOutOthersButton({ disabled }: { disabled: boolean }) {
  const [state, signOutOthers, pending] = useAuthMutation(async () => {
    const { error } = await authClient.revokeOtherSessions();
    return { error, message: "Other devices are signed out." };
  });
  return (
    <form action={signOutOthers} className="flex flex-col items-end gap-2">
      <Button
        type="submit"
        variant="outline"
        disabled={pending || disabled}
        className="pointer-coarse:min-h-11"
      >
        {pending && <Spinner className="motion-reduce:animate-none" />}
        Sign out other devices
      </Button>
      <MutationMessage state={state} />
    </form>
  );
}
