import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Form-level result. Errors use role="alert" so screen readers announce them on submit;
// confirmations are polite.
export function FormAlert({
  tone,
  children,
  id,
}: {
  tone: "error" | "success";
  children: ReactNode;
  id?: string;
}) {
  return (
    <Alert
      id={id}
      variant={tone === "error" ? "destructive" : "default"}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? undefined : "polite"}
    >
      <HugeiconsIcon
        icon={tone === "error" ? AlertCircleIcon : CheckmarkCircle02Icon}
        strokeWidth={2}
      />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
