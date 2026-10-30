"use server";

import { requireSession } from "@/lib/session";
import { type ConsentLinkResult, linkConsentSubject } from "./consent-link";

// Called by ConsentIdentity in signed-in shells with this browser's consent subject id.
export async function linkConsentSubjectAction(
  subjectId: string,
): Promise<ConsentLinkResult> {
  const { user } = await requireSession();
  return linkConsentSubject(user.id, subjectId);
}
