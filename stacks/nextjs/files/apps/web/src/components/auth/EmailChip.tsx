"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/initials";
import { AUTH_SPRING } from "./motion";

// The address picked in the first step, carried into the next as a chip. "Change" goes back
// with the address still filled in.
export function EmailChip({
  email,
  name,
  onChange,
}: {
  email: string;
  // Sign up knows the name by now, so the avatar shows its initials.
  name?: string;
  onChange: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={AUTH_SPRING}
      className="flex items-center gap-3 rounded-full border bg-card p-1 shadow-xs"
    >
      <Avatar aria-hidden="true">
        <AvatarFallback className="bg-primary/10 font-medium text-primary dark:bg-primary/40 dark:text-primary-foreground">
          {initials(name || email)}
        </AvatarFallback>
      </Avatar>
      <span
        title={email}
        className="min-w-0 flex-1 truncate text-sm font-medium"
      >
        {email}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onChange}
        aria-label={`Change email, ${email}`}
        className="rounded-full pointer-coarse:min-h-11"
      >
        <HugeiconsIcon
          icon={PencilEdit02Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Change
      </Button>
    </motion.div>
  );
}
