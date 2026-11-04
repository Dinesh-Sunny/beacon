"use client";

// Next.js useOffline: when the connection drops, say so calmly. Answers live in this browser,
// so nothing is lost, and Next retries navigations and Server Actions on its own.
import { useOffline } from "next/offline";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";

export function OfflineNotice() {
  const offline = useOffline();
  const t = useTranslations("offline");
  if (!offline) return null;
  return (
    <div className="offline-note" role="status">
      <Icon name="warn" size={16} /> {t("note")}
    </div>
  );
}
