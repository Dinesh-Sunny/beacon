"use client";

import "./globals.css";
import {
  type BoundaryError,
  ErrorPanel,
} from "@/components/feedback/ErrorPanel";
import { FONT_CLASS_NAMES } from "@/lib/fonts";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

// Last line of defence: the root layout itself failed, so this replaces it and brings its own
// <html> (like global-not-found.tsx). It can't export metadata, so the title is a <title> tag.
export default function GlobalError({
  error,
  retry,
}: {
  error: BoundaryError;
  retry: () => void;
}) {
  return (
    <html
      lang={SITE.language}
      className={cn("h-full", "antialiased", FONT_CLASS_NAMES)}
    >
      <body className="flex min-h-full flex-col">
        <title>{`Something went wrong · ${SITE.name}`}</title>
        <main className="flex flex-1">
          <ErrorPanel
            title="This page didn't load"
            error={error}
            retry={retry}
          />
        </main>
      </body>
    </html>
  );
}
