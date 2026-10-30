"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { STEP_VARIANTS } from "./motion";

// Swaps one step of an in-page flow for the next: the old step blurs out one way, the new one
// springs in from the other. `step` keys the swap; `direction` comes from useSteps.
export function StepSwitch({
  step,
  direction,
  children,
}: {
  step: string;
  direction: number;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        variants={STEP_VARIANTS}
        initial="enter"
        animate="center"
        exit="exit"
        className="flex flex-col gap-6"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
