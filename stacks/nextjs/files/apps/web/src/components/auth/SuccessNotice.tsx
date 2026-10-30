"use client";

import type { ReactNode } from "react";
import { Tick02Icon } from "@/components/ui/tick-02";
import { AnimatedBadge } from "./AnimatedBadge";
import { AuthHeading } from "./AuthHeading";

// A finished step: an animated tick, what is now true, and the one way forward.
export function SuccessNotice({
  title,
  description,
  children,
  level,
  focusOnMount = true,
  celebrate = true,
}: {
  // Sparks around the tick; off for outcomes that aren't a win (a declined invitation).
  celebrate?: boolean;
  level?: 1 | 2;
  // False when the notice is the page's first render rather than a form's replacement.
  focusOnMount?: boolean;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        media={
          <AnimatedBadge
            burst={celebrate}
            render={(ref) => <Tick02Icon ref={ref} size={30} />}
          />
        }
        title={title}
        focusOnMount={focusOnMount}
        description={description}
        level={level}
      />
      {children}
    </div>
  );
}
