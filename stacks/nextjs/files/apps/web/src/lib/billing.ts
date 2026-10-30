import {
  BILLING_ENV,
  getBillingAlert,
  getLiveSubscription,
  getOrganizationPlan,
  loadPlanPrices,
  type PlanPrice,
  roleAllowsBilling,
  seatsTaken,
} from "@__NAME__/auth";
import type { Route } from "next";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { getAccountContext } from "@/lib/account";
import { COUNTRY_HEADER, visitorCurrency } from "@/lib/billing-currency";

// Billing is on only when apps/web/src/lib/auth.ts passes Stripe to Better Auth.
export function isBillingConfigured(): boolean {
  return Boolean(
    process.env[BILLING_ENV.secretKey] &&
      process.env[BILLING_ENV.webhookSecret],
  );
}

// Prices change rarely and every account page view would otherwise call Stripe.
async function cachedPlanPrices(): Promise<PlanPrice[]> {
  "use cache";
  cacheLife("hours");
  const secretKey = process.env[BILLING_ENV.secretKey];
  return secretKey ? loadPlanPrices(secretKey) : [];
}

// Stripe being unreachable must not take the page down: status and seats still show, and the
// picker says prices are unavailable. Null is never cached, so the next view tries again.
async function planPricesOrNull(): Promise<PlanPrice[] | null> {
  try {
    return await cachedPlanPrices();
  } catch (error) {
    console.error("[billing] could not load plan prices", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

// Everything /account/billing shows for the active organization. Null when the user has no
// organization; `canRead` false for members (access.ts: billing is owners and admins).
export async function loadBilling(from: Route) {
  const { activeOrganization } = await getAccountContext(from);
  if (!activeOrganization) return null;
  const role = activeOrganization.role ?? undefined;
  const canRead = roleAllowsBilling(role, "list-subscription");
  const base = {
    organization: activeOrganization,
    canRead,
    canManage: roleAllowsBilling(role, "upgrade-subscription"),
    configured: isBillingConfigured(),
  };
  if (!canRead) return { ...base, data: null };
  const [plan, alert, live, seatsUsed, prices, requestHeaders] =
    await Promise.all([
      getOrganizationPlan(activeOrganization.id),
      getBillingAlert(activeOrganization.id),
      getLiveSubscription(activeOrganization.id),
      seatsTaken(activeOrganization.id),
      base.configured ? planPricesOrNull() : Promise.resolve([]),
      headers(),
    ]);
  return {
    ...base,
    data: {
      plan,
      alert,
      hasLiveSubscription: live !== null,
      seatsUsed,
      prices,
      currency: visitorCurrency(requestHeaders.get(COUNTRY_HEADER)),
    },
  };
}
