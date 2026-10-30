"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COPIED_RESET_MS = 2_000;

// Copies a value, then confirms with a tick and an announcement.
export function CopyButton({
  value,
  label = "Copy",
  variant = "outline",
}: {
  value: string;
  label?: string;
  variant?: "outline" | "secondary" | "default";
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    // Clipboard access can be refused (permissions, insecure context); say so, since the value
    // may be shown only once.
    const copied = await navigator.clipboard.writeText(value).then(
      () => true,
      () => false,
    );
    setStatus(copied ? "copied" : "failed");
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={copy}
      className="pointer-coarse:min-h-11"
    >
      <HugeiconsIcon
        icon={status === "copied" ? Tick02Icon : Copy01Icon}
        strokeWidth={2}
      />
      <span aria-live="polite">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Couldn't copy. Select the text instead."
            : label}
      </span>
    </Button>
  );
}
