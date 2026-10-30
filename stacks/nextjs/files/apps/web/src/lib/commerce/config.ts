// Single source of truth for the shop's Stripe Checkout integration (docs/adr/0003-commerce.md).
// Pure, so tests and the Payload config import it.

// The ecommerce plugin's payment method name: its endpoints live under /api/payments/<name>.
export const SHOP_PAYMENT_METHOD = "stripe-checkout";

// Every Checkout Session we create carries this in metadata. Organization billing (Better Auth's
// Stripe plugin) shares the Stripe account and receives the same events; each side ignores the
// other's sessions.
export const SHOP_FLOW = "shop";

// The shop webhook's own signing secret (a second endpoint in the Stripe Dashboard).
export const SHOP_WEBHOOK_SECRET_ENV = "SHOP_STRIPE_WEBHOOK_SECRET";

// Unpaid sessions expire after this, which bounds how long stock checked at checkout can go
// stale (Stripe's minimum is 30 minutes).
export const CHECKOUT_EXPIRY_MINUTES = 30;

// Tags shop sessions in the Stripe Dashboard (8 random letters per Stripe's guidance).
export const SHOP_INTEGRATION_IDENTIFIER = "__NAME__-shop-checkout-mxqtpbzr";

// UK and EU consumer prices are shown including VAT; US prices exclude sales tax.
export const TAX_BEHAVIOR = {
  GBP: "inclusive",
  EUR: "inclusive",
  USD: "exclusive",
} as const;

// Stripe allows up to five shipping options per session.
export const MAX_SHIPPING_RATES = 5;

// Quantities a single cart line may hold, so a typo can't create a huge charge.
export const MAX_LINE_QUANTITY = 99;

// Webhook events the shop handles; anything else is acknowledged and ignored.
export const SHOP_EVENTS = {
  completed: "checkout.session.completed",
  asyncSucceeded: "checkout.session.async_payment_succeeded",
  asyncFailed: "checkout.session.async_payment_failed",
  expired: "checkout.session.expired",
  refunded: "charge.refunded",
} as const;
