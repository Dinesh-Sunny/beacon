// Browser/React client. Mirrors the server plugins in auth.ts so calls are typed; roles come
// from the same access definitions as the server.
import { apiKeyClient } from "@better-auth/api-key/client";
import { stripeClient } from "@better-auth/stripe/client";
import {
  adminClient,
  jwtClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, ORG_ROLES } from "./access.ts";
import { AUTH_BASE_PATH } from "./config.ts";

export function createAgencyAuthClient() {
  return createAuthClient({
    basePath: AUTH_BASE_PATH,
    plugins: [
      organizationClient({ ac, roles: ORG_ROLES }),
      adminClient(),
      apiKeyClient(),
      jwtClient(),
      twoFactorClient(),
      magicLinkClient(),
      stripeClient({ subscription: true }),
    ],
  });
}
