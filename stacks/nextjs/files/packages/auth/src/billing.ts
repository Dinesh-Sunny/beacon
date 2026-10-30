// Organization billing: who may change it, what Checkout collects, and what a plan allows.
// Organizations pay, never individual users. The Stripe plugin itself is wired in auth.ts.
import { getDb } from "@__NAME__/db";
import type { stripe } from "@better-auth/stripe";
import { APIError } from "better-auth/api";
import Stripe from "stripe";
import { ORG_ROLES, type OrgRole } from "./access.ts";
import {
  AUTH_DB_SCHEMA,
  BILLING_CURRENCIES,
  type BillingCurrency,
  CLEARING_STATUSES,
  ENDED_STATUSES,
  ENTITLED_STATUSES,
  FAILED_STATUSES,
  FREE_LIMITS,
  FREE_PLAN,
  PENDING_INVITATION_STATUS,
  PLANS,
  type PlanLimits,
  type PlanName,
  type PlanPrice,
  SEAT_LIMIT_ERROR_CODE,
} from "./config.ts";

type SubscriptionOptions = Extract<
  NonNullable<Parameters<typeof stripe>[0]["subscription"]>,
  { enabled: true }
>;
type AuthorizeReference = NonNullable<
  SubscriptionOptions["authorizeReference"]
>;
type BillingAction = Parameters<AuthorizeReference>[0]["action"];

// Listing needs billing:read; anything that changes or opens billing needs billing:manage.
function permissionFor(action: BillingAction): "read" | "manage" {
  return action === "list-subscription" ? "read" : "manage";
}

function isOrgRole(role: string): role is OrgRole {
  return Object.hasOwn(ORG_ROLES, role);
}

// Pure so it can be tested: a member's stored role string (comma-separated) against an action.
export function roleAllowsBilling(
  storedRole: string | undefined,
  action: BillingAction,
): boolean {
  if (!storedRole) return false;
  const permission = permissionFor(action);
  return storedRole
    .split(",")
    .map((role) => role.trim())
    .filter(isOrgRole)
    .some(
      (role) => ORG_ROLES[role].authorize({ billing: [permission] }).success,
    );
}

export type LiveSubscription = {
  stripeSubscriptionId: string;
  status: string;
  plan: string;
  billingInterval: string | null;
};

// The organization's Stripe subscription that can still bill it (anything not ended), if any.
// Abandoned checkouts have no Stripe id and don't count.
export async function getLiveSubscription(
  organizationId: string,
): Promise<LiveSubscription | null> {
  const { rows } = await getDb().$client.query<{
    stripe_subscription_id: string;
    status: string;
    plan: string;
    billing_interval: string | null;
  }>(
    `select stripe_subscription_id, status, plan, billing_interval
       from ${AUTH_DB_SCHEMA}.subscription
      where reference_id = $1
        and stripe_subscription_id is not null
        and status <> all($2::text[])
      order by period_end desc nulls first
      limit 1`,
    [organizationId, ENDED_STATUSES],
  );
  const row = rows[0];
  return row
    ? {
        stripeSubscriptionId: row.stripe_subscription_id,
        status: row.status,
        plan: row.plan,
        billingInterval: row.billing_interval,
      }
    : null;
}

type ReferenceBody = { customerType?: string; subscriptionId?: string };

// Pure so it can be tested. Organizations pay, never users: every billing call must name the
// organization as the customer. A plan change must name the organization's live subscription,
// or the plugin would start a second one beside it (two bills, or two Stripe subscriptions
// writing one row while a debit clears or a renewal is retried).
export function billingRequestAllowed(
  action: BillingAction,
  body: ReferenceBody | undefined,
  live: LiveSubscription | null,
): boolean {
  if (body?.customerType !== "organization") return false;
  if (action !== "upgrade-subscription") return true;
  return live === null || body.subscriptionId === live.stripeSubscriptionId;
}

// The reference is always an organization id; a user can act only on organizations they belong
// to, with the role the action needs (access.ts: owners manage, admins read).
export const authorizeOrganizationBilling: AuthorizeReference = async (
  { user, referenceId, action },
  ctx,
) => {
  const { rows } = await getDb().$client.query<{ role: string }>(
    `select role from ${AUTH_DB_SCHEMA}.member
      where user_id::text = $1 and organization_id::text = $2`,
    [user.id, referenceId],
  );
  if (!roleAllowsBilling(rows[0]?.role, action)) return false;
  const body = (ctx.body ?? ctx.query) as ReferenceBody | undefined;
  const live =
    action === "upgrade-subscription"
      ? await getLiveSubscription(referenceId)
      : null;
  return billingRequestAllowed(action, body, live);
};

// Checkout for every plan: the billing address and business tax id are always collected, so
// Stripe Tax can work them out once it's on. No `payment_method_types`: Checkout then offers what
// the Dashboard enables for the price's currency (card, plus Bacs for GBP and SEPA for EUR).
export const CHECKOUT_SESSION_PARAMS = {
  billing_address_collection: "required",
  customer_update: { address: "auto", name: "auto" },
  tax_id_collection: { enabled: true },
  // Tags our sessions in the Dashboard so this flow can be compared with others.
  integration_identifier: "__NAME__-org-subscriptions-qhvmtwzc",
} as const satisfies Partial<Stripe.Checkout.SessionCreateParams>;

// How long a Stripe Tax answer is trusted before asking again. "Not ready" is rechecked sooner,
// so turning Tax on in the Dashboard reaches checkout within minutes.
const TAX_READY_TTL_MS = 60 * 60 * 1000;
const TAX_NOT_READY_TTL_MS = 5 * 60 * 1000;
let taxReady: { value: boolean; checkedAt: number } | undefined;

// Stripe Tax collects nothing without an active head-office setup and at least one active
// registration, yet `automatic_tax` still looks on. So it is turned on only when both exist,
// and the gap is logged loudly otherwise (a new sandbox has neither). If Stripe can't be asked
// (outage, a restricted key without tax read), checkout still works untaxed and the answer
// isn't cached.
export async function isStripeTaxReady(stripeClient: Stripe): Promise<boolean> {
  const now = Date.now();
  if (
    taxReady &&
    now - taxReady.checkedAt <
      (taxReady.value ? TAX_READY_TTL_MS : TAX_NOT_READY_TTL_MS)
  ) {
    return taxReady.value;
  }
  try {
    const [settings, registrations] = await Promise.all([
      stripeClient.tax.settings.retrieve(),
      stripeClient.tax.registrations.list({ status: "active", limit: 1 }),
    ]);
    const value = settings.status === "active" && registrations.data.length > 0;
    if (!value) {
      console.error(
        "[billing] Stripe Tax isn't active or has no registrations: checkout collects no tax. See docs/knowledge/payments.md",
      );
    }
    taxReady = { value, checkedAt: now };
    return value;
  } catch (error) {
    console.error(
      "[billing] couldn't check Stripe Tax; checkout runs untaxed",
      {
        error: error instanceof Error ? error.name : "unknown",
      },
    );
    return false;
  }
}

export async function checkoutSessionParams(
  stripeClient: Stripe,
): Promise<Stripe.Checkout.SessionCreateParams> {
  return {
    ...CHECKOUT_SESSION_PARAMS,
    automatic_tax: { enabled: await isStripeTaxReady(stripeClient) },
  };
}

export type OrganizationPlan = {
  name: PlanName;
  // Passed back to the plugin when switching plans, so Stripe updates the subscription in place.
  stripeSubscriptionId: string | null;
  // Stripe's interval ("month" or "year"); null on the free tier.
  billingInterval: string | null;
  limits: PlanLimits;
  status: string | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

const FREE: OrganizationPlan = {
  name: FREE_PLAN,
  stripeSubscriptionId: null,
  billingInterval: null,
  limits: FREE_LIMITS,
  status: null,
  periodEnd: null,
  cancelAtPeriodEnd: false,
};

// The plan an organization is entitled to right now. Read straight from the subscription table
// (indexed by reference id), so it needs no request headers and works in jobs and webhooks.
export async function getOrganizationPlan(
  organizationId: string,
): Promise<OrganizationPlan> {
  const { rows } = await getDb().$client.query<{
    plan: string;
    status: string;
    stripe_subscription_id: string | null;
    billing_interval: string | null;
    period_end: Date | null;
    cancel_at_period_end: boolean | null;
  }>(
    `select plan, status, stripe_subscription_id, billing_interval, period_end,
            cancel_at_period_end
       from ${AUTH_DB_SCHEMA}.subscription
      where reference_id = $1 and status = any($2::text[])
      order by period_end desc nulls last
      limit 1`,
    [organizationId, ENTITLED_STATUSES],
  );
  const row = rows[0];
  const plan = row && PLANS.find((candidate) => candidate.name === row.plan);
  if (!row || !plan) return FREE;
  return {
    name: plan.name,
    stripeSubscriptionId: row.stripe_subscription_id,
    billingInterval: row.billing_interval,
    limits: plan.limits,
    status: row.status,
    periodEnd: row.period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  };
}

// True when the organization's plan allows `amount` of `limit`, e.g. can(orgId, "seats", 12).
export async function can(
  organizationId: string,
  limit: keyof PlanLimits,
  amount: number,
): Promise<boolean> {
  const { limits } = await getOrganizationPlan(organizationId);
  return amount <= limits[limit];
}

// Members plus open invitations, so invitations can't be stacked past the plan's seats.
export async function seatsTaken(organizationId: string): Promise<number> {
  const { rows } = await getDb().$client.query<{ taken: number }>(
    `select ((select count(*) from ${AUTH_DB_SCHEMA}.member
                where organization_id::text = $1)
           + (select count(*) from ${AUTH_DB_SCHEMA}.invitation
                where organization_id::text = $1 and status = $2
                  and expires_at > now()))::int as taken`,
    [organizationId, PENDING_INVITATION_STATUS],
  );
  return rows[0]?.taken ?? 0;
}

// Refuses an invitation or a new member that would take the organization past its seats.
// `pending` is 1 when the seat being filled is already counted as an open invitation. Two
// invitations sent at the same instant can both pass; the invite rate limit bounds that.
export async function assertSeatAvailable(
  organizationId: string,
  pending = 0,
): Promise<void> {
  const taken = await seatsTaken(organizationId);
  if (await can(organizationId, "seats", taken - pending + 1)) return;
  throw new APIError("FORBIDDEN", {
    code: SEAT_LIMIT_ERROR_CODE,
    message:
      "This organization has no seats left. An owner can upgrade the plan or remove someone.",
  });
}

// Stripe subscription ids still billing these organizations (anything not ended).
export async function liveSubscriptionIds(
  organizationIds: readonly string[],
): Promise<string[]> {
  if (organizationIds.length === 0) return [];
  const { rows } = await getDb().$client.query<{
    stripe_subscription_id: string;
  }>(
    `select stripe_subscription_id from ${AUTH_DB_SCHEMA}.subscription
      where reference_id = any($1::text[])
        and stripe_subscription_id is not null
        and status <> all($2::text[])`,
    [organizationIds, ENDED_STATUSES],
  );
  return rows.map((row) => row.stripe_subscription_id);
}

// Ends these subscriptions now. Safe to run twice: one Stripe already ended is skipped, so a
// retried job (or Payload 3 running it twice) has one effect. Throws when any cancel fails, so
// the job retries the rest. Stripe keeps customers and invoices for tax records.
export async function cancelStripeSubscriptions(
  secretKey: string,
  stripeSubscriptionIds: readonly string[],
): Promise<void> {
  const stripeClient = new Stripe(secretKey);
  const ended: readonly string[] = ENDED_STATUSES;
  const results = await Promise.allSettled(
    stripeSubscriptionIds.map(async (id) => {
      const subscription = await stripeClient.subscriptions.retrieve(id);
      if (ended.includes(subscription.status)) return;
      await stripeClient.subscriptions.cancel(id);
    }),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      `Couldn't cancel ${failures.length} of ${stripeSubscriptionIds.length} subscriptions`,
    );
  }
}

function amountsOf(
  price: Stripe.Price,
): Partial<Record<BillingCurrency, number>> {
  const amounts: Partial<Record<BillingCurrency, number>> = {};
  for (const currency of BILLING_CURRENCIES) {
    const amount =
      price.currency === currency
        ? price.unit_amount
        : price.currency_options?.[currency]?.unit_amount;
    if (typeof amount === "number") amounts[currency] = amount;
  }
  return amounts;
}

// Display prices for the plan picker, read by lookup key. Checkout charges whatever Stripe holds,
// so these are only shown, never trusted.
export async function loadPlanPrices(secretKey: string): Promise<PlanPrice[]> {
  const stripeClient = new Stripe(secretKey);
  const { data } = await stripeClient.prices.list({
    lookup_keys: PLANS.flatMap((plan) => [
      plan.lookupKey,
      plan.annualDiscountLookupKey,
    ]),
    expand: ["data.currency_options"],
    active: true,
    limit: 100,
  });
  const byKey = new Map(data.map((price) => [price.lookup_key, price]));
  return PLANS.map((plan) => {
    const monthly = byKey.get(plan.lookupKey);
    const annual = byKey.get(plan.annualDiscountLookupKey);
    return {
      plan: plan.name,
      monthly: monthly ? amountsOf(monthly) : {},
      annual: annual ? amountsOf(annual) : {},
    };
  });
}

// Something about the organization's billing the owner should act on or wait for.
// - clearing: a direct debit (Bacs, SEPA) was set up at checkout and is still being collected;
//   the Stripe subscription exists, so it isn't an abandoned checkout (those have no id).
// - failed: a renewal payment failed and Stripe is retrying; the plan is locked meanwhile.
export type BillingAlert = "clearing" | "failed" | null;

export async function getBillingAlert(
  organizationId: string,
): Promise<BillingAlert> {
  const live = await getLiveSubscription(organizationId);
  if (!live) return null;
  if ((CLEARING_STATUSES as readonly string[]).includes(live.status))
    return "clearing";
  if ((FAILED_STATUSES as readonly string[]).includes(live.status))
    return "failed";
  return null;
}
