"use client";

import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { SiteNavLink } from "@/components/site/SiteNavLink";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SiteLink } from "@/payload-types";

// Header links under `md`. Any tap on a link closes the sheet, including links to the page
// already shown, hash links, and external links (a pathname change alone misses those).
export function MobileNav({ links }: { links: NonNullable<SiteLink> }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden pointer-coarse:size-11"
        >
          <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="max-w-xs motion-reduce:animate-none"
      >
        <SheetHeader className="min-h-16 justify-center">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="px-4">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.id ?? link.href} className="border-b">
                <SiteNavLink
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="-mx-2 flex min-h-11 items-center rounded-md px-2 text-base text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-current-page:text-foreground"
                >
                  {link.label}
                </SiteNavLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
