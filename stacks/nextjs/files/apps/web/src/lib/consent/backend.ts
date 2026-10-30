import { resolveAuthOrigins } from "@__NAME__/auth/origins";
import { getDb } from "@__NAME__/db";
import { type C15TInstance, c15tInstance, policyBuilder } from "@c15t/backend";
import { drizzleAdapter } from "@c15t/backend/db/adapters/drizzle";
import { SITE } from "@/lib/site";
import {
  CLIENT_IP_HEADER,
  CONSENT_API_PATH,
  CONSENT_CATEGORIES,
  CONSENT_EXPIRY_DAYS,
} from "./config";
import { CONSENT_COPY } from "./consent-copy";

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

// Origins that may call the consent API: this environment's own, like Better Auth. Requests are
// same-origin in practice; this only governs CORS (scripts ignore it; see request-guard.ts).
export function trustedOrigins(): string[] {
  const { canonical, allowedHosts } = resolveAuthOrigins();
  const hosts = allowedHosts
    .filter((host) => !host.includes("*"))
    .map((host) => `https://${host}`);
  const local = process.env.NODE_ENV === "production" ? [] : LOCAL_ORIGINS;
  return [...new Set([canonical, ...hosts, ...local])];
}

// One opt-in policy everywhere: a UK business selling worldwide asks every visitor, and
// rejecting is exactly as easy as accepting (ICO). Client projects can add regional packs
// (c15t policy packs) when they need different rules.
const POLICY_PACKS = policyBuilder.createPackWithDefault([], {
  id: "default_opt_in",
  model: "opt-in",
  expiryDays: CONSENT_EXPIRY_DAYS,
  categories: [...CONSENT_CATEGORIES],
  preselectedCategories: ["necessary"],
  uiMode: "banner",
  // Only the categories above are accepted; unknown keys are rejected instead of creating rows.
  scopeMode: "strict",
  banner: {
    allowedActions: ["accept", "reject", "customize"],
    primaryActions: ["accept", "reject"],
  },
  dialog: { allowedActions: ["accept", "reject", "customize"] },
  proof: { storeIp: true, storeUserAgent: true, storeLanguage: true },
});

// Hostnames the banner reports as `domain` (window.location.hostname); anything else is refused.
export function consentHostnames(): string[] {
  return trustedOrigins().map((origin) => new URL(origin).hostname);
}

let instance: C15TInstance | undefined;

// Self-hosted c15t on our Postgres (tables in the `consent` schema). Lazy so `next build` needs
// no database. Records are append-only consent proofs for UK GDPR: who chose what, when, under
// which policy.
export function getConsentBackend(): C15TInstance {
  instance ??= c15tInstance({
    appName: SITE.name,
    basePath: CONSENT_API_PATH,
    trustedOrigins: trustedOrigins(),
    adapter: drizzleAdapter({ db: getDb(), provider: "postgresql" }),
    // Keep the IP as proof of who consented, minus the last octet (IPv4) or 80 bits (IPv6). Read
    // only x-real-ip, which Vercel sets; c15t would otherwise trust x-client-ip from the client.
    ipAddress: {
      tracking: true,
      masking: true,
      ipAddressHeaders: [CLIENT_IP_HEADER],
    },
    // The API reference UI is for local development only.
    openapi: { enabled: process.env.NODE_ENV !== "production" },
    telemetry: { enabled: false },
    branding: "none",
    // c15t logs subject and account ids at info level; logs ship to Axiom.
    logger: { level: "warn" },
    policyPacks: POLICY_PACKS,
    customTranslations: { [SITE.language]: CONSENT_COPY },
  });
  return instance;
}
