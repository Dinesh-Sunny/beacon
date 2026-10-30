import { cn } from "@/lib/utils";

// Where you are in a multi-step flow: a row of dots where the current step stretches into a pill.
// Step names are for screen readers; sighted visitors read the heading.
export function StepProgress({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol aria-label="Progress" className="flex items-center gap-1.5">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className="flex"
        >
          <span
            aria-hidden="true"
            className={cn(
              "block h-1.5 w-1.5 rounded-full bg-muted-foreground/25 transition-all duration-500 ease-out motion-reduce:transition-none",
              index < current && "bg-primary/50",
              index === current && "w-7 bg-primary",
            )}
          />
          <span className="sr-only">
            {step}
            {index < current ? " (done)" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
