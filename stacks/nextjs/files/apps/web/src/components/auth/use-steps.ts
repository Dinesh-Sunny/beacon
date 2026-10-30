"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { SHAKE_KEYFRAMES, SHAKE_SECONDS } from "./motion";

// The current step of an in-page flow plus which way it moved, so StepSwitch slides the right way.
// `moved` stays false until the first step change: the first screen keeps its natural focus.
export function useSteps<Step extends string>(order: readonly Step[]) {
  const [state, setState] = useState({
    step: order[0],
    direction: 1,
    moved: false,
  });
  const go = (step: Step) =>
    setState((previous) => ({
      step,
      direction: order.indexOf(step) >= order.indexOf(previous.step) ? 1 : -1,
      moved: true,
    }));
  return { ...state, index: order.indexOf(state.step), go };
}

// Moves focus into a step that just slid in, so keyboard and screen reader users land on its
// first field instead of the button that disappeared.
export function useFocusOnMount(id: string, enabled: boolean) {
  useEffect(() => {
    if (enabled) document.getElementById(id)?.focus();
  }, [id, enabled]);
}

// Shakes the scoped element each time `trigger` changes to a new truthy value (a fresh error
// state from useActionState). Skipped under reduced motion; the alert still says what went wrong.
export function useShake<T extends Element>(trigger: unknown) {
  const [scope, animate] = useAnimate<T>();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!trigger || reduceMotion || !scope.current) return;
    animate(scope.current, SHAKE_KEYFRAMES, {
      duration: SHAKE_SECONDS,
      ease: "easeOut",
    });
  }, [trigger, reduceMotion, animate, scope]);
  return scope;
}
