import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink";
import { SITE } from "@/lib/site";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { StepProgress } from "./StepProgress";

export { AuthHeading } from "./AuthHeading";

type AuthShellProps = {
  children: ReactNode;
  // Multi-step flows pass their steps; single screens leave it out.
  steps?: readonly string[];
  currentStep?: number;
};

// Split screen from lg: the task in the wider left column, a quiet panel (how the account is
// protected) on the right. The brand mark and the form share one left edge, and the form starts
// at a fixed offset so headings don't jump between screens or tabs. The panel's card starts on
// the same line (AUTH_CONTENT_TOP in AuthBrandPanel). Narrow screens get the task alone.
export function AuthShell({
  children,
  steps,
  currentStep = 0,
}: AuthShellProps) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-5">
      <main className="flex min-w-0 flex-col px-4 pt-6 pb-16 sm:px-10 lg:col-span-3">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <AuthBrand />
          <div className="flex flex-col gap-8 pt-6 sm:pt-12 lg:pt-20">
            {steps && <StepProgress steps={steps} current={currentStep} />}
            {children}
          </div>
        </div>
        <footer className="mx-auto mt-auto w-full max-w-sm pt-12">
          <CookieSettingsLink className="h-auto px-0 text-muted-foreground" />
        </footer>
      </main>
      <AuthBrandPanel className="hidden lg:col-span-2 lg:flex" />
    </div>
  );
}

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 self-start rounded-md font-heading text-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HugeiconsIcon
          icon={SquareLock02Icon}
          strokeWidth={2}
          className="size-4"
          aria-hidden="true"
        />
      </span>
      {SITE.name}
    </Link>
  );
}
