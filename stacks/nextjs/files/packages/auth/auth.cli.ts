// Entry point for the Better Auth CLI only (`pnpm --filter @__NAME__/auth auth:generate`), which
// reads plugins and options to generate the Drizzle schema. Never imported by app code.
import { createAuth } from "./src/auth.ts";
import { resolveAuthOrigins } from "./src/origins.ts";

export const auth = createAuth({
  appName: "__NAME__",
  secret: "schema-generation-only-not-a-secret",
  origins: resolveAuthOrigins({ NODE_ENV: "development" }),
  // Turns the Stripe plugin on so its tables are generated; never used to call Stripe.
  stripe: {
    secretKey: "sk_test_schema_generation_only",
    webhookSecret: "whsec_schema_generation_only",
  },
});
