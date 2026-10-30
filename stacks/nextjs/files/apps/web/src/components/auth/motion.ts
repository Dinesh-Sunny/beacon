import type { Transition, Variants } from "motion/react";

// One spring for everything that moves on the auth screens, so steps, chips, and badges share a
// feel. Under reduced motion MotionProvider drops the transforms and keeps the fades.
export const AUTH_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

const STEP_OFFSET = 28;
const STEP_BLUR = "blur(6px)";
const STEP_EXIT_SECONDS = 0.14;

// Forward steps enter from the right and leave to the left; going back reverses it.
export const STEP_VARIANTS: Variants = {
  enter: (direction: number) => ({
    x: direction * STEP_OFFSET,
    opacity: 0,
    filter: STEP_BLUR,
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: AUTH_SPRING,
  },
  exit: (direction: number) => ({
    x: direction * -STEP_OFFSET,
    opacity: 0,
    filter: STEP_BLUR,
    transition: { duration: STEP_EXIT_SECONDS, ease: "easeIn" },
  }),
};

// A wrong password or code nods "no": a quick decaying side-to-side.
export const SHAKE_KEYFRAMES = { x: [0, -10, 9, -6, 4, -2, 0] };
export const SHAKE_SECONDS = 0.42;
