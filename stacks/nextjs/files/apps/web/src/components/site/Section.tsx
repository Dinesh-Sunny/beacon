import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Shared width and rhythm for every site section, so blocks line up with the header and footer.
export const SITE_CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

// Every block's top-level heading uses one scale; headings inside rich text step down.
export const SECTION_HEADING = "font-heading text-3xl text-balance sm:text-4xl";

export function Section({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(SITE_CONTAINER, "py-16 sm:py-20", className)}
      {...props}
    />
  );
}
