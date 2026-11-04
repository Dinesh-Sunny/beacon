// Pages slide forward into the check and back to the site (React ViewTransition with the
// transition types Next.js Link passes). Unrelated updates don't animate.
import { type ReactNode, ViewTransition } from "react";

const DIRECTION = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTION} exit={DIRECTION} default="none">
      {children}
    </ViewTransition>
  );
}
