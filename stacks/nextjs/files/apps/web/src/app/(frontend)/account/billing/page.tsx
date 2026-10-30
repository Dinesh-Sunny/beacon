import {
  FREE_LIMITS,
  FREE_PLAN,
  FREE_PLAN_TITLE,
  PLANS,
} from "@__NAME__/auth/config";
import { CreditCardIcon, LockPasswordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import {
  BillingPlans,
  type PlanOption,
} from "@/components/account/BillingPlans";
import { CreateOrganizationButton } from "@/components/account/CreateOrganizationButton";
import { ManageBillingButton } from "@/components/account/ManageBillingButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { loadBilling } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Billing",
  path: AUTH_ROUTES.accountBilling,
  noIndex: true,
});

function planTitle(name: string): string {
  if (name === FREE_PLAN) return FREE_PLAN_TITLE;
  return PLANS.find((plan) => plan.name === name)?.title ?? name;
}

function BillingEmpty({
  title,
  description,
  action,
  icon = CreditCardIcon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof CreditCardIcon;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

async function Billing() {
  const billing = await loadBilling(AUTH_ROUTES.accountBilling);
  const header = (action?: ReactNode) => (
    <AccountPageHeader
      title="Billing"
      description={
        billing
          ? `The plan ${billing.organization.name} is on, and its payments.`
          : "Plans and payments belong to an organization."
      }
      action={action}
    />
  );

  if (!billing) {
    return (
      <>
        {header()}
        <BillingEmpty
          title="Billing belongs to an organization"
          description="Create one first. It starts on the free plan."
          action={<CreateOrganizationButton />}
        />
      </>
    );
  }

  if (!billing.data) {
    return (
      <>
        {header()}
        <BillingEmpty
          icon={LockPasswordIcon}
          title="Owners and admins see billing"
          description={`Ask an owner of ${billing.organization.name} about its plan.`}
        />
      </>
    );
  }

  const { plan, alert, hasLiveSubscription, seatsUsed, prices, currency } =
    billing.data;
  const isPaid = plan.name !== FREE_PLAN;
  const seatLimit = plan.limits.seats;
  const seatShare = Math.min(100, Math.round((seatsUsed / seatLimit) * 100));
  const planOptions: PlanOption[] = [
    { name: FREE_PLAN, title: planTitle(FREE_PLAN), seats: FREE_LIMITS.seats },
    ...PLANS.map((option) => {
      const price = prices?.find((entry) => entry.plan === option.name);
      return {
        name: option.name,
        title: planTitle(option.name),
        seats: option.limits.seats,
        monthly: price?.monthly[currency],
        annual: price?.annual[currency],
      };
    }),
  ];
  // The portal fixes a failed card or a clearing debit too, not only paid plans.
  const showPortal =
    billing.canManage && billing.configured && hasLiveSubscription;

  return (
    <>
      {header(
        showPortal && (
          <ManageBillingButton organizationId={billing.organization.id} />
        ),
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="flex flex-wrap items-center gap-2">
              {planTitle(plan.name)}
              {isPaid && (
                <Badge variant="secondary" className="font-sans">
                  {plan.cancelAtPeriodEnd ? "Ending" : "Active"}
                </Badge>
              )}
            </h2>
          </CardTitle>
          <CardDescription>
            {!isPaid
              ? "Free resources stay open. Subscribe when you need more seats."
              : plan.periodEnd
                ? `${plan.cancelAtPeriodEnd ? "Ends" : "Renews"} on ${formatDate(plan.periodEnd)}.`
                : "Billed through Stripe."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium">Seats</span>
              <span className="text-muted-foreground tabular-nums">
                {seatsUsed} of {seatLimit}
              </span>
            </div>
            <Progress
              value={seatShare}
              aria-label={`${seatsUsed} of ${seatLimit} seats used`}
              className="*:bg-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {seatsUsed > seatLimit
                ? `${seatsUsed - seatLimit} over the plan's limit. New invitations are paused until you upgrade or remove someone.`
                : "Members and open invitations both take a seat."}
            </p>
          </div>
          {alert === "clearing" && (
            <Alert>
              <AlertTitle>Your direct debit is clearing</AlertTitle>
              <AlertDescription>
                Bank debits take about three working days. The new plan starts
                when the payment arrives.
              </AlertDescription>
            </Alert>
          )}
          {alert === "failed" && (
            <Alert variant="destructive">
              <AlertTitle>The last payment didn't go through</AlertTitle>
              <AlertDescription>
                Stripe will try again. Update the payment method in Manage
                billing to keep the plan.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {billing.configured && prices === null ? (
        <BillingEmpty
          title="Prices aren't available right now"
          description="Stripe didn't answer. Reload the page in a minute to see plans."
        />
      ) : billing.configured ? (
        <BillingPlans
          plans={planOptions}
          currentPlan={plan.name}
          currency={currency}
          locale={SITE.language}
          organizationId={billing.organization.id}
          subscriptionId={plan.stripeSubscriptionId}
          currentInterval={plan.billingInterval}
          // A clearing debit or failed renewal is still a live subscription: a new checkout
          // beside it would bill twice, so changes wait (the server refuses them too).
          locked={hasLiveSubscription && !isPaid}
          canManage={billing.canManage}
        />
      ) : (
        <BillingEmpty
          title="Payments aren't set up on this site"
          description="Every organization is on the free plan until Stripe is connected."
        />
      )}
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Billing />
    </Suspense>
  );
}
