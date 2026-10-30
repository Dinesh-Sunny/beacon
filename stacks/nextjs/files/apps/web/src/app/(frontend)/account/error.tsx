"use client";

import {
  type BoundaryError,
  ErrorPanel,
} from "@/components/feedback/ErrorPanel";

// Inside the account shell (SidebarInset is already <main>), so the panel is a plain region.
export default function AccountError({
  error,
  retry,
}: {
  error: BoundaryError;
  retry: () => void;
}) {
  return (
    <ErrorPanel title="This page didn't load" error={error} retry={retry} />
  );
}
