"use client";

import type { BillingCurrency, PlanName } from "@__NAME__/auth/config";
import { useState, useTransition } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { cn } from "@/lib/utils";
import { MutationMessage } from "./MutationMessage";
import type { MutationState } from "./use-auth-mutation";

const INTERVALS = ["monthly", "annual"] as const;
type Interval = (typeof INTERVALS)[number];

// Stripe's names for the same intervals, as stored on the subscription.
const STRIPE_INTERVAL: Record<Interval, string> = {
  monthly: "month",
  annual: "year",
};

const MONTHS_PER_YEAR = 12;

// Months an annual price saves against twelve monthly ones, from the real prices (so the badge
// stays true when a project changes them). Zero when there's no saving or no prices.
function annualSavingMonths(plans: PlanOption[]): number {
  const priced = plans.find(
    (plan) => plan.monthly !== undefined && plan.annual !== undefined,
  );
  if (!priced?.monthly || priced.annual === undefined) return 0;
  return Math.max(
    0,
    Math.round(MONTHS_PER_YEAR - priced.annual / priced.monthly),
  );
}

export type PlanOption = {
  name: PlanName;
  title: string;
  seats: number;
  // Minor units in `currency`; undefined when Stripe has no price for it (or for the free tier).
  monthly?: number;
  annual?: number;
};

// Splits "£29" into the symbol and the number, so the number can slide between intervals while
// the symbol stays put, in the order the locale writes them.
function priceParts(minor: number, currency: BillingCurrency, locale: string) {
  const whole = minor % 100 === 0;
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
  }).formatToParts(minor / 100);
  const symbolFirst =
    parts.findIndex((part) => part.type === "currency") <
    parts.findIndex((part) => part.type === "integer");
  const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
  return { symbol, symbolFirst, value: minor / 100, decimals: whole ? 0 : 2 };
}

function Price({
  minor,
  currency,
  locale,
  interval,
}: {
  minor: number;
  currency: BillingCurrency;
  locale: string;
  interval: Interval;
}) {
  const { symbol, symbolFirst, value, decimals } = priceParts(
    minor,
    currency,
    locale,
  );
  const label = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
  }).format(value);
  return (
    <p className="flex items-baseline gap-1">
      <span className="sr-only">
        {label} {interval === "annual" ? "per year" : "per month"}
      </span>
      <span
        aria-hidden
        className="flex items-baseline font-heading text-3xl tabular-nums"
      >
        {symbolFirst && symbol}
        <SlidingNumber number={value} decimalPlaces={decimals} />
        {!symbolFirst && symbol}
      </span>
      <span aria-hidden className="text-sm text-muted-foreground">
        {interval === "annual" ? "/ year" : "/ month"}
      </span>
    </p>
  );
}

// The plan cards and the monthly/annual switch. Only the plan one step above the current one
// gets the primary button: it is the next action; every other choice stays outlined.
export function BillingPlans({
  plans,
  currentPlan,
  currency,
  locale,
  organizationId,
  subscriptionId,
  currentInterval,
  locked,
  canManage,
}: {
  plans: PlanOption[];
  currentPlan: PlanName;
  currency: BillingCurrency;
  locale: string;
  organizationId: string;
  subscriptionId: string | null;
  // Stripe interval of the current subscription ("month" or "year"); null on the free tier.
  currentInterval: string | null;
  // True while a payment settles (direct debit clearing, renewal failed): no changes offered.
  locked: boolean;
  canManage: boolean;
}) {
  const [interval, setBillingInterval] = useState<Interval>(
    currentInterval === STRIPE_INTERVAL.annual ? "annual" : "monthly",
  );
  const savingMonths = annualSavingMonths(plans);
  const canChange = canManage && !locked;
  const [pending, setPending] = useState<PlanName | null>(null);
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const [, startTransition] = useTransition();

  const currentIndex = plans.findIndex((plan) => plan.name === currentPlan);
  const nextPlan = plans[currentIndex + 1]?.name;

  function choose(plan: PlanName) {
    setPending(plan);
    setState({ status: "idle" });
    startTransition(async () => {
      const here = new URL(AUTH_ROUTES.accountBilling, window.location.origin);
      // Redirects to Stripe Checkout (or updates the subscription in place when one exists).
      const { error } = await authClient.subscription.upgrade({
        plan,
        annual: interval === "annual",
        referenceId: organizationId,
        customerType: "organization",
        subscriptionId: subscriptionId ?? undefined,
        successUrl: here.toString(),
        cancelUrl: here.toString(),
      });
      if (error) {
        setState({ status: "error", message: authErrorMessage(error) });
        setPending(null);
      }
    });
  }

  return (
    <section aria-labelledby="plans-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plans-heading" className="font-heading text-xl">
          Plans
        </h2>
        <Tabs
          value={interval}
          onValueChange={(value) => setBillingInterval(value as Interval)}
        >
          <TabsList
            aria-label="Billing interval"
            className="pointer-coarse:h-11"
          >
            <TabsTrigger value="monthly" className="px-3">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="annual" className="px-3">
              Annual
              {savingMonths > 0 && (
                <span className="text-muted-foreground">
                  {savingMonths} {savingMonths === 1 ? "month" : "months"} free
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentPlan;
          // The same plan on the other interval is still a change worth offering.
          const isCurrentChoice =
            isCurrent &&
            (currentInterval === null ||
              currentInterval === STRIPE_INTERVAL[interval]);
          const isNext = plan.name === nextPlan;
          const price = interval === "annual" ? plan.annual : plan.monthly;
          const isFree =
            plan.monthly === undefined && plan.annual === undefined;
          return (
            <li
              key={plan.name}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground",
                isCurrent && "border-foreground/30 bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{plan.title}</h3>
                {isCurrent && <Badge variant="secondary">Current plan</Badge>}
              </div>
              {isFree ? (
                <Price
                  minor={0}
                  currency={currency}
                  locale={locale}
                  interval={interval}
                />
              ) : price === undefined ? (
                <p className="text-sm text-muted-foreground">
                  No {currency.toUpperCase()} price yet
                </p>
              ) : (
                <Price
                  minor={price}
                  currency={currency}
                  locale={locale}
                  interval={interval}
                />
              )}
              <p className="text-sm text-muted-foreground">
                {isFree
                  ? `Free resources, and up to ${plan.seats} people.`
                  : `Up to ${plan.seats} people. Prices exclude tax.`}
              </p>
              <div className="mt-auto pt-2">
                {canChange &&
                  !isCurrentChoice &&
                  !isFree &&
                  price !== undefined && (
                    <Button
                      className="w-full pointer-coarse:min-h-11"
                      variant={isNext ? "default" : "outline"}
                      disabled={pending !== null}
                      onClick={() => choose(plan.name)}
                    >
                      {pending === plan.name && (
                        <Spinner data-icon="inline-start" />
                      )}
                      {isCurrent
                        ? `Switch to ${interval}`
                        : currentIndex > plans.indexOf(plan)
                          ? `Switch to ${plan.title}`
                          : `Upgrade to ${plan.title}`}
                    </Button>
                  )}
                {canChange && !isCurrent && isFree && (
                  <p className="text-sm text-muted-foreground">
                    To go back to free, cancel in Manage billing.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!canManage && (
        <p className="text-sm text-muted-foreground">
          Only owners can change the plan.
        </p>
      )}
      {canManage && locked && (
        <p className="text-sm text-muted-foreground">
          Plan changes open again once the current payment settles.
        </p>
      )}
      <MutationMessage state={state} />
    </section>
  );
}
