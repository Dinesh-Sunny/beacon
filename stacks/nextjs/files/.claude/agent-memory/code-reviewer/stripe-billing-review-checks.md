---
name: stripe-billing-review-checks
description: @better-auth/stripe 1.7.7 review checks (duplicate subs from non-entitled states, plugin blocks org delete, swallowed webhook errors, customerType/referenceId auth, item-level period fields)
metadata:
  type: project
---

First seen reviewing feat/payments (2026-10-03, @better-auth/stripe 1.7.7, stripe 22).

- upgrade with no `subscriptionId` while a past_due/unpaid/incomplete sub exists creates a SECOND Stripe subscription (only active/trialing are matched; incomplete row gets reused and its stripeSubscriptionId overwritten). UIs that derive "current plan" from entitled statuses only will offer Upgrade then. Check routes upgrade ~L640-1110.
- Plugin init injects `beforeDeleteOrganization` that refuses deletion when the org's Stripe customer has any non-canceled/incomplete sub (ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION). App "cancel on org delete" hooks are mostly dead; docs claiming otherwise are wrong.
- Webhook handlers catch and log their own errors and still return 200, so Stripe never retries a failed DB write.
- referenceMiddleware: customerType omitted ("user") + explicit referenceId still calls authorizeReference. An org-only authorizeReference must also check `ctx.body.customerType`.
- Handlers read `items.data[].current_period_*` (Stripe API basil+). Webhook endpoints pinned to an older API version give Invalid Date and the update fails silently.
- Hooks that call Stripe before local cleanup (API-key deletes) skip the cleanup if Stripe throws. Put local deletes first.

**Why:** these pass unit tests that insert subscription rows directly. They only show up with real Stripe state transitions.
**How to apply:** for billing changes, walk each subscription status through the page UI and the upgrade route. See also [[better-auth-review-checks]].
