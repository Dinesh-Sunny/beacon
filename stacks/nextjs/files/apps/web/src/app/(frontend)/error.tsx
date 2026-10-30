"use client";

import {
  type BoundaryError,
  ErrorPanel,
} from "@/components/feedback/ErrorPanel";

// Catches failures in segment layouts (the account shell, auth pages) that their own error.tsx
// can't: an error boundary never wraps the layout beside it.
export default function FrontendError({
  error,
  retry,
}: {
  error: BoundaryError;
  retry: () => void;
}) {
  return (
    <main className="flex flex-1">
      <ErrorPanel title="This page didn't load" error={error} retry={retry} />
    </main>
  );
}
