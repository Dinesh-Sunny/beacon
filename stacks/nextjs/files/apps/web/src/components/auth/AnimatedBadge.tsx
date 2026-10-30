"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, useEffect, useRef } from "react";
import type { AnimatedIconHandle } from "@/lib/use-icon-animation";
import { cn } from "@/lib/utils";
import { AUTH_SPRING } from "./motion";

const BURST = {
  particles: 12,
  near: 40,
  far: 52,
  // Lands as the tick finishes drawing (Tick02Icon's stroke completes at ~0.64s).
  delaySeconds: 0.55,
  seconds: 0.8,
  colors: ["bg-primary", "bg-chart-2", "bg-chart-1", "bg-primary/50"],
} as const;

const BURST_PARTICLES = Array.from({ length: BURST.particles }, (_, index) => {
  const angle = (index / BURST.particles) * Math.PI * 2;
  const distance = index % 2 ? BURST.far : BURST.near;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: BURST.colors[index % BURST.colors.length],
  };
});

// A result icon (mail sent, done) that pops in and plays its animation once. `burst` adds a ring
// of sparks for finished flows. Under reduced motion the icon is still and the sparks are skipped.
export function AnimatedBadge({
  render,
  burst = false,
}: {
  render: (ref: Ref<AnimatedIconHandle>) => ReactNode;
  burst?: boolean;
}) {
  const icon = useRef<AnimatedIconHandle>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    icon.current?.startAnimation();
  }, []);
  return (
    <span
      aria-hidden="true"
      className="relative flex size-16 items-center justify-center"
    >
      {burst &&
        !reduceMotion &&
        BURST_PARTICLES.map((particle) => (
          <motion.span
            key={`${particle.x}:${particle.y}`}
            className={cn("absolute size-1.5 rounded-full", particle.color)}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: particle.x,
              y: particle.y,
              scale: [0, 1.2, 0],
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: BURST.seconds,
              delay: BURST.delaySeconds,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      <motion.span
        initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={AUTH_SPRING}
        className="relative flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary dark:bg-primary/40 dark:text-primary-foreground"
      >
        {render(icon)}
      </motion.span>
    </span>
  );
}
