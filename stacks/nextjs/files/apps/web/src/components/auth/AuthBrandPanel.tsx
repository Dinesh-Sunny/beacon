"use client";

import {
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  PASSWORD_POLICY,
} from "@__NAME__/auth/config";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import {
  Shield02Icon,
  type Shield02IconHandle,
} from "@/components/ui/shield-02";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

// Only what the auth config guarantees. A client fork that changes a policy changes this list.
const PROTECTIONS = [
  `Passwords need ${PASSWORD_POLICY.minLength} or more characters and are checked against known data breaches.`,
  "Two-factor sign-in with any authenticator app, plus single-use backup codes.",
  `Email sign-in links work once and expire after ${formatDuration(MAGIC_LINK_EXPIRES_IN_SECONDS)}.`,
  "Resetting your password signs out every other device.",
] as const;

// Quiet on purpose: primary colour belongs to the form's next action, so the grid is a faint
// texture and slow to change.
const GRID = {
  squareSize: 4,
  gridGap: 6,
  flickerChance: 0.1,
  maxOpacity: 0.12,
};

// The canvas can't read CSS variables, so the grid takes the computed colour of a token-styled
// element once it's on screen.
function useTokenColor() {
  const probe = useRef<HTMLSpanElement>(null);
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (probe.current) setColor(getComputedStyle(probe.current).color);
  }, []);
  return { probe, color };
}

// Its top padding equals the left column's brand row plus the form offset (pt-6 + h-8 + gap-8 +
// pt-20), so the card's top edge lines up with the form's heading.
export function AuthBrandPanel({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const { probe, color } = useTokenColor();
  const shield = useRef<Shield02IconHandle>(null);

  useEffect(() => {
    shield.current?.startAnimation();
  }, []);

  return (
    <aside
      aria-label="How your account is protected"
      className={cn(
        "relative isolate flex-col border-l bg-muted px-10 pt-42 pb-16",
        className,
      )}
    >
      <span ref={probe} aria-hidden="true" className="text-primary" />
      {/* Under reduced motion the texture is skipped: the canvas loop would redraw a still
          frame sixty times a second. */}
      {color && !reduceMotion && (
        <FlickeringGrid
          aria-hidden="true"
          className="absolute inset-0 -z-10 mask-radial-at-bottom-right mask-radial-from-0% mask-radial-to-80%"
          color={color}
          squareSize={GRID.squareSize}
          gridGap={GRID.gridGap}
          flickerChance={GRID.flickerChance}
          maxOpacity={GRID.maxOpacity}
        />
      )}
      <div className="flex max-w-sm flex-col gap-6 rounded-xl bg-card p-6 text-card-foreground shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield02Icon ref={shield} size={20} aria-hidden="true" />
          </span>
          <h2 className="font-heading text-lg text-balance">
            Protected from the first sign-in
          </h2>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
          {PROTECTIONS.map((fact) => (
            <li key={fact} className="flex gap-3">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-pretty">{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
