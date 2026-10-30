// Single source of truth for Payload slugs, roles, and cache tags.

export const COLLECTIONS = {
  users: "users",
  media: "media",
  pages: "pages",
  // One document per tenant (the multi-tenant plugin's `isGlobal`).
  navigation: "navigation",
  tenants: "tenants",
  // Shoppers: one per Better Auth user who checked out signed in (docs/adr/0003-commerce.md).
  customers: "customers",
  // The ecommerce plugin's collections (its default slugs).
  products: "products",
  variants: "variants",
  variantTypes: "variantTypes",
  variantOptions: "variantOptions",
  carts: "carts",
  orders: "orders",
  transactions: "transactions",
} as const;

// Shop currencies a tenant can sell in (ISO 4217). Each tenant picks one; Stripe Adaptive
// Pricing shows local prices at checkout.
export const SHOP_CURRENCIES = ["GBP", "EUR", "USD"] as const;
export type ShopCurrency = (typeof SHOP_CURRENCIES)[number];
export const DEFAULT_SHOP_CURRENCY: ShopCurrency = "GBP";

// The tenant that owns all content in a single-tenant fork and answers any host that isn't a
// known tenant domain (docs/adr/0002-multi-tenancy.md). Seeded by migration; never deleted.
export const DEFAULT_TENANT_SLUG = "default";

export const TENANT_STATUSES = ["active", "suspended"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

// Block slugs for `pages.layout`. Renaming one needs a migration: each is its own table.
export const BLOCKS = {
  hero: "hero",
  features: "features",
  callToAction: "callToAction",
  richText: "richText",
  faq: "faq",
} as const;

// The published page that renders at `/`; `/home` redirects there.
export const HOME_SLUG = "home";

// Icons editors can pick for feature items; components/site/feature-icons.ts maps each to a
// Hugeicons glyph. Removing a value needs a migration (it's a Postgres enum).
export const FEATURE_ICONS = [
  "sparkles",
  "shield",
  "rocket",
  "flash",
  "people",
  "clock",
  "globe",
  "lock",
  "check",
  "chart",
  "support",
  "leaf",
  "settings",
  "delivery",
  "heart",
] as const;

export type FeatureIcon = (typeof FEATURE_ICONS)[number];

// Payload's built-in collection of queued and failed jobs.
export const JOBS_COLLECTION = "payload-jobs";

export const ROLES = {
  admin: "admin",
  editor: "editor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Payload owns a second pool next to @__NAME__/db's; keep it small so both fit provider limits.
export const PAYLOAD_POOL_MAX = 5;

// Postgres schema for every Payload table, kept apart from our Drizzle tables in `public`.
export const PAYLOAD_DB_SCHEMA = "payload";

// Cache tags for `use cache` reads of CMS content; hooks revalidate them on change.
// Every content tag carries the tenant, so publishing in one site never refreshes another.
export const CACHE_TAGS = {
  tenants: "tenants",
  pages: (tenantId: string) => `t:${tenantId}:pages`,
  page: (tenantId: string, slug: string) => `t:${tenantId}:page:${slug}`,
  navigation: (tenantId: string) => `t:${tenantId}:navigation`,
} as const;

// SES tag for every email Payload sends (it doesn't say which template it rendered).
export const PAYLOAD_EMAIL_KIND = "cms";

// Payload's admin route (its default; config.routes.admin). next.config.ts scopes headers to it.
export const PAYLOAD_ADMIN_ROUTE = "/admin";

// How long an editor's password-reset link works (Payload's default is the same hour).
export const CMS_RESET_EXPIRES_IN_SECONDS = 60 * 60;

// Job queues: `default` for work triggered by people (retries), `maintenance` for scheduled
// cleanup. The cron route runs both (vercel.json).
export const JOB_QUEUES = {
  default: "default",
  maintenance: "maintenance",
} as const;

// Task slugs (payload/jobs). Renaming one needs a migration: they're a Postgres enum.
export const JOB_TASKS = {
  cancelSubscriptions: "cancel-subscriptions",
  sendAuthEmail: "send-auth-email",
  authCleanup: "auth-cleanup",
  consentRetention: "consent-retention",
  jobsCleanup: "jobs-cleanup",
  agentThreadsCleanup: "agent-threads-cleanup",
  privacyErase: "privacy-erase",
  auditPartitions: "audit-partitions",
} as const;

// Payload's cron has a seconds field first, in the server's time zone (UTC on Vercel).
export const DAILY_MAINTENANCE_CRON = "0 0 3 * * *";

// A job still processing after this long had its runner killed (the platform allows 300 s), so
// the daily cleanup releases it to run again.
export const STUCK_JOB_MINUTES = 15;

// Failed jobs are kept this long for inspection, then removed (their input can hold email links).
export const FAILED_JOB_RETENTION_DAYS = 14;
