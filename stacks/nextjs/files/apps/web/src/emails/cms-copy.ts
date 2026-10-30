import { formatDuration } from "@/lib/format";
import { SITE } from "@/lib/site";
import { CMS_RESET_EXPIRES_IN_SECONDS } from "@/payload/constants";
import type { ActionEmailCopy } from "./ActionEmail";

// Payload's editor password reset (CMS staff, not app users).
export function cmsResetCopy(): ActionEmailCopy {
  const window = formatDuration(CMS_RESET_EXPIRES_IN_SECONDS);
  return {
    subject: `Reset your ${SITE.name} CMS password`,
    preview: `The link works for ${window}.`,
    heading: "Reset your CMS password",
    paragraphs: [
      `Someone asked to reset the password for this editor account. The link works for ${window}.`,
    ],
    action: "Choose a new password",
    footnote:
      "Didn't ask for this? Ignore this email. Your password stays the same.",
  };
}
