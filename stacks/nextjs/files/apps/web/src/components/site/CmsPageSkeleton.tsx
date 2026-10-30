import { Section } from "@/components/site/Section";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while a CMS page streams in after navigation.
export function CmsPageSkeleton() {
  return (
    <Section aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading page</span>
      <Skeleton className="h-12 w-2/3 max-w-xl" />
      <Skeleton className="h-5 w-full max-w-prose" />
      <Skeleton className="h-5 w-5/6 max-w-prose" />
      <Skeleton className="h-5 w-3/4 max-w-prose" />
    </Section>
  );
}
