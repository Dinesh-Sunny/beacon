import { Skeleton } from "@/components/ui/skeleton";
import { AuthShell } from "./AuthShell";

// Shown while a sign-in screen reads its link parameters.
export function AuthSkeleton() {
  return (
    <AuthShell>
      <output aria-busy="true" className="flex flex-col gap-6">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </output>
    </AuthShell>
  );
}
