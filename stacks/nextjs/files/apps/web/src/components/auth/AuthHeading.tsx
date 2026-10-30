"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { TextMorph } from "@/components/ui/text-morph";

export function AuthHeading({
  title,
  description,
  media,
  level = 1,
  focusOnMount = false,
  morph = false,
}: {
  // Result screens replace the form that held focus; moving focus to the new heading keeps
  // keyboard and screen reader users in place (WCAG 2.4.3) and announces the result.
  focusOnMount?: boolean;
  title: string;
  description?: ReactNode;
  // An animated icon above the heading for result screens (inbox, done).
  media?: ReactNode;
  // 2 when the heading sits inside a page that already has its own h1.
  level?: 1 | 2;
  // In-page flows change the title per step; its letters rearrange instead of swapping.
  morph?: boolean;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <header className="flex flex-col gap-2">
      {media && <div className="mb-4">{media}</div>}
      <Heading
        ref={ref}
        tabIndex={focusOnMount ? -1 : undefined}
        className={
          level === 1
            ? "font-heading text-4xl tracking-tight text-balance outline-none"
            : "font-heading text-2xl text-balance outline-none"
        }
      >
        {morph ? (
          <>
            <span className="sr-only">{title}</span>
            <span aria-hidden="true">
              <TextMorph as="span">{title}</TextMorph>
            </span>
          </>
        ) : (
          title
        )}
      </Heading>
      {description && (
        <p className="text-pretty text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
