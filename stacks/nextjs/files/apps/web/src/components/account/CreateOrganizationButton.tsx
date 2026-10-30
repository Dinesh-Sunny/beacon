"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";

export function CreateOrganizationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="pointer-coarse:min-h-11">
        <HugeiconsIcon
          icon={PlusSignIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Create organization
      </Button>
      <CreateOrganizationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
