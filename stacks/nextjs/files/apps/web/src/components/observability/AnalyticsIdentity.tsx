"use client";

import { useEffect } from "react";
import { identifyUser } from "@/lib/observability/analytics";

// Rendered inside signed-in shells: ties error reports and analytics to the user id (never the
// email or name). Renders nothing.
export function AnalyticsIdentity({ userId }: { userId: string }) {
  useEffect(() => {
    identifyUser(userId);
  }, [userId]);
  return null;
}
