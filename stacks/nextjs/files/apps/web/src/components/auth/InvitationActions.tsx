"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { FormAlert } from "./FormAlert";
import { SuccessNotice } from "./SuccessNotice";

type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "declined" };

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [state, respond, pending] = useActionState(
    async (_previous: InviteState, form: FormData): Promise<InviteState> => {
      if (form.get("intent") === "decline") {
        const { error } = await authClient.organization.rejectInvitation({
          invitationId,
        });
        return error
          ? { status: "error", message: authErrorMessage(error) }
          : { status: "declined" };
      }
      const { error } = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (error) return { status: "error", message: authErrorMessage(error) };
      router.push(AUTH_ROUTES.accountTeam);
      router.refresh();
      return { status: "idle" };
    },
    { status: "idle" },
  );

  if (state.status === "declined") {
    return (
      <SuccessNotice
        level={2}
        celebrate={false}
        title="Invitation declined"
        description="Nothing else changes. You can close this page."
      />
    );
  }

  return (
    <form action={respond} className="flex flex-col gap-4">
      {state.status === "error" && (
        <FormAlert tone="error">{state.message}</FormAlert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          name="intent"
          value="accept"
          disabled={pending}
          className="pointer-coarse:min-h-11"
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Join organization
        </Button>
        <Button
          type="submit"
          name="intent"
          value="decline"
          variant="outline"
          disabled={pending}
          className="pointer-coarse:min-h-11"
        >
          Decline
        </Button>
      </div>
    </form>
  );
}
