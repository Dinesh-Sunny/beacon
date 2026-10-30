import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

// Organizations have no logo yet: a primary-tinted square with initials stands in.
export function OrgAvatar({
  name,
  size = "default",
}: {
  name: string;
  size?: "default" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground",
        size === "lg" ? "size-14 rounded-2xl text-lg" : "size-8 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}
