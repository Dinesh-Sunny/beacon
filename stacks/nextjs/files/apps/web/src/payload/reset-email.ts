import { resolveAuthOrigins } from "@__NAME__/auth/origins";
import type { CollectionConfig } from "payload";
import { cmsResetCopy } from "@/emails/cms-copy";
import {
  CMS_RESET_EXPIRES_IN_SECONDS,
  PAYLOAD_ADMIN_ROUTE,
} from "@/payload/constants";

type ForgotPassword = NonNullable<
  Exclude<CollectionConfig["auth"], boolean | undefined>["forgotPassword"]
>;

const MS_PER_SECOND = 1_000;

// Payload builds its reset link from the request origin, which is empty unless `serverURL` is
// set, so its default email links to a relative path that no mail client can open. Setting
// serverURL would also turn on Payload's CSRF origin list, so the link is built here instead,
// from the same canonical origin as app emails (per-preview on Vercel).
export const forgotPasswordEmail: ForgotPassword = {
  expiration: CMS_RESET_EXPIRES_IN_SECONDS * MS_PER_SECOND,
  generateEmailSubject: () => cmsResetCopy().subject,
  generateEmailHTML: async (args) => {
    if (!args?.token)
      throw new Error("Payload sent a reset email without a token");
    // Loaded on demand: the email renderer reads globals.css and pulls in React Email, which
    // the Payload config (also loaded by CLI scripts) shouldn't need.
    const { renderActionHtml } = await import("@/emails/render");
    const url = new URL(
      `${PAYLOAD_ADMIN_ROUTE}/reset/${encodeURIComponent(args.token)}`,
      resolveAuthOrigins().canonical,
    );
    return renderActionHtml(cmsResetCopy(), url.toString());
  },
};
