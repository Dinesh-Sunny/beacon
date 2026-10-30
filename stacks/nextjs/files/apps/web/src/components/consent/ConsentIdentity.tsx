"use client";

import { useConsentManager } from "@c15t/nextjs";
import { useEffect } from "react";
import { linkConsentSubjectAction } from "@/lib/privacy/actions";

// Rendered in signed-in shells: once this browser has recorded a consent choice, its consent
// subject is linked to the account (server side, unlinked subjects only). If the subject belongs
// to someone else (a shared browser), the stored choice is cleared: the banner asks again and
// the new choice gets its own subject. Renders nothing.
export function ConsentIdentity() {
  const { consentInfo, resetConsents } = useConsentManager();
  const subjectId = consentInfo?.subjectId;
  useEffect(() => {
    if (!subjectId) return;
    linkConsentSubjectAction(subjectId)
      .then((result) => {
        if (result === "other-account") resetConsents();
      })
      .catch((error: unknown) => {
        // The next signed-in page load tries again; nothing for the person to do.
        console.warn("[consent] couldn't link this browser's choices", {
          error: error instanceof Error ? error.name : "unknown",
        });
      });
  }, [subjectId, resetConsents]);
  return null;
}
