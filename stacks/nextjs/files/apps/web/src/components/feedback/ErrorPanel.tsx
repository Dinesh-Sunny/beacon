"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type BoundaryError = Error & { digest?: string };

// Body of an error boundary. `retry` re-fetches the segment, so a passing database blip recovers.
// The boundary caught the error, so nothing else reports it: send it to Sentry once. Server
// errors arrive with only a digest (Next hides the message), which matches the server log.
export function ErrorPanel({
  title,
  error,
  retry,
}: {
  title: string;
  error: BoundaryError;
  retry: () => void;
}) {
  useEffect(() => {
    // Server errors were already reported by onRequestError; the digest tag links the two.
    Sentry.captureException(
      error,
      error.digest ? { tags: { digest: error.digest } } : undefined,
    );
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>
            {/* The segment failed, so this is the only heading on the page. */}
            <h1>{title}</h1>
          </EmptyTitle>
          <EmptyDescription>
            Something went wrong on our side. Try again in a moment; nothing you
            saved has changed.
          </EmptyDescription>
          {error.digest && (
            <p className="select-all font-mono text-muted-foreground text-xs">
              Reference {error.digest}
            </p>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={retry} className="pointer-coarse:min-h-11">
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
