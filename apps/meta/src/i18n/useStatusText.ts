"use client";

import { useTranslations } from "use-intl";
import type { Status } from "@/engine/rules";

/** A status word ("Likely", "Worth checking") in the reader's language. */
export function useStatusText() {
  const t = useTranslations("status");
  return (s: Status) => t(s);
}
