import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingRequestAllowed,
  CHECKOUT_SESSION_PARAMS,
  roleAllowsBilling,
} from "./billing.ts";

test("should let owners manage billing and admins only read it", () => {
  assert.equal(roleAllowsBilling("owner", "upgrade-subscription"), true);
  assert.equal(roleAllowsBilling("owner", "billing-portal"), true);
  assert.equal(roleAllowsBilling("admin", "list-subscription"), true);
  assert.equal(roleAllowsBilling("admin", "upgrade-subscription"), false);
  assert.equal(roleAllowsBilling("admin", "cancel-subscription"), false);
});

test("should refuse members, non-members, and unknown roles", () => {
  assert.equal(roleAllowsBilling("member", "list-subscription"), false);
  assert.equal(roleAllowsBilling(undefined, "list-subscription"), false);
  assert.equal(roleAllowsBilling("superuser", "billing-portal"), false);
});

test("should read every role in a multi-role membership", () => {
  assert.equal(roleAllowsBilling("member,owner", "billing-portal"), true);
});

test("should collect what Stripe Tax needs at checkout", () => {
  assert.equal(CHECKOUT_SESSION_PARAMS.billing_address_collection, "required");
  assert.equal(CHECKOUT_SESSION_PARAMS.customer_update.address, "auto");
  assert.ok(!("payment_method_types" in CHECKOUT_SESSION_PARAMS));
});

const LIVE = {
  stripeSubscriptionId: "sub_live",
  status: "past_due",
  plan: "starter",
  billingInterval: "month",
};

test("should refuse billing calls that don't name the organization as the customer", () => {
  assert.equal(billingRequestAllowed("billing-portal", {}, null), false);
  assert.equal(
    billingRequestAllowed("list-subscription", { customerType: "user" }, null),
    false,
  );
});

test("should refuse a second checkout beside a live subscription", () => {
  const org = { customerType: "organization" };
  assert.equal(billingRequestAllowed("upgrade-subscription", org, LIVE), false);
  assert.equal(
    billingRequestAllowed(
      "upgrade-subscription",
      { ...org, subscriptionId: "sub_other" },
      LIVE,
    ),
    false,
  );
  assert.equal(
    billingRequestAllowed(
      "upgrade-subscription",
      { ...org, subscriptionId: "sub_live" },
      LIVE,
    ),
    true,
  );
  assert.equal(billingRequestAllowed("upgrade-subscription", org, null), true);
});
