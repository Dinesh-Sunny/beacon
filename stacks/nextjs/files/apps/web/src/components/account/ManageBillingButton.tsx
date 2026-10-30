"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";

// Opens Stripe's customer portal for the organization: payment method, invoices, cancel.
export function ManageBillingButton({
  organizationId,
}: {
  organizationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await authClient.subscription.billingPortal({
        referenceId: organizationId,
        customerType: "organization",
        returnUrl: new URL(
          AUTH_ROUTES.accountBilling,
          window.location.origin,
        ).toString(),
      });
      if (result.error) setError(authErrorMessage(result.error));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={open}
        disabled={pending}
        className="pointer-coarse:min-h-11"
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
        )}
        Manage billing
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
