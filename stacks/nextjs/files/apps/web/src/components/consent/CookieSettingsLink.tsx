"use client";

import { useConsentManager } from "@c15t/nextjs";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { COOKIE_SETTINGS_LABEL } from "@/lib/consent/consent-copy";
import { cn } from "@/lib/utils";

// Reopens the consent dialog, so withdrawing is as easy as giving consent. Shown wherever a
// page has room for small print: the home footer, the auth shell, the account user menu.
export function CookieSettingsLink({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const { setActiveUI } = useConsentManager();
  return (
    <Button
      type="button"
      variant="link"
      className={cn("min-h-6 pointer-coarse:min-h-11", className)}
      onClick={() => setActiveUI("dialog")}
      {...props}
    >
      {COOKIE_SETTINGS_LABEL}
    </Button>
  );
}
