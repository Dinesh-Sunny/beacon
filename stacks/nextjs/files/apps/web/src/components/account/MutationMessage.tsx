import type { MutationState } from "./use-auth-mutation";

// Inline result under a form: errors are announced, confirmations are polite.
export function MutationMessage({ state }: { state: MutationState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.message}
      </p>
    );
  }
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {state.status === "done" ? state.message : null}
    </p>
  );
}
