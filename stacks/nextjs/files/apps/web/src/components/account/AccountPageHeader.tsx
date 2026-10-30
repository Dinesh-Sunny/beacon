import type { ReactNode } from "react";

// Title, what the page is for, and an optional primary action on the right.
export function AccountPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          tabIndex={-1}
          className="font-heading text-3xl text-balance outline-none"
        >
          {title}
        </h1>
        <p className="text-pretty text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}
