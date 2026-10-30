import { useId } from "react";
import { cn } from "@/lib/utils";

const DOT_SPACING = 20;
const DOT_RADIUS = 1;

// A quiet dotted field behind a section, fading out from one corner. One SVG <pattern> rather
// than an element per dot (the Magic UI dot-pattern renders thousands of circles and measures
// the window), so it costs nothing to paint and needs no client JavaScript.
export function DotBackdrop({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 size-full text-foreground/15",
        "mask-radial-at-top-right mask-radial-from-0% mask-radial-to-70%",
        className,
      )}
    >
      <defs>
        <pattern
          id={id}
          width={DOT_SPACING}
          height={DOT_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={DOT_SPACING / 2}
            cy={DOT_SPACING / 2}
            r={DOT_RADIUS}
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
