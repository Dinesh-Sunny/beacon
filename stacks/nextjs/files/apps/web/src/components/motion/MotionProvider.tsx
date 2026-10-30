"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Every motion component honours the visitor's reduced-motion setting (transforms and layout
// animations are skipped; opacity still fades).
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
