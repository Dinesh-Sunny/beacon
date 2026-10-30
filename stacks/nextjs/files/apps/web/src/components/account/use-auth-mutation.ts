"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { type AuthClientError, authErrorMessage } from "@/lib/auth-errors";

export type MutationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message?: string };

type MutationResult = { error?: AuthClientError | null; message?: string };

// Calls a Better Auth client method (HTTP, so rate limiting and origin checks apply), reports
// the result in plain words, and refreshes the server-rendered account data on success.
export function useAuthMutation(
  run: (form: FormData) => Promise<MutationResult>,
) {
  const router = useRouter();
  return useActionState(
    async (
      _previous: MutationState,
      form: FormData,
    ): Promise<MutationState> => {
      const result = await run(form);
      if (result.error)
        return { status: "error", message: authErrorMessage(result.error) };
      router.refresh();
      return { status: "done", message: result.message };
    },
    { status: "idle" } as MutationState,
  );
}
