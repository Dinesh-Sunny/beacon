import { CmsLink } from "@/components/site/CmsLink";
import { cn } from "@/lib/utils";
import type { ActionLink } from "@/payload-types";

// Hero and call-to-action buttons. Primary is the main action; editors are asked to use it once.
export function Actions({
  actions,
  prominent = false,
}: {
  actions: ActionLink | null | undefined;
  // Larger buttons for the hero, where the action leads the page.
  prominent?: boolean;
}) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <CmsLink
          key={action.id ?? action.href}
          href={action.href}
          button={{
            variant: action.appearance === "secondary" ? "outline" : "default",
            size: "lg",
          }}
          className={cn(
            "pointer-coarse:min-h-11",
            prominent && "h-11 px-5 text-base",
          )}
        >
          {action.label}
        </CmsLink>
      ))}
    </div>
  );
}
