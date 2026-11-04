"use client";

// Between the first answer and the first result: how much is still possible, so each answer visibly counts.

import { useTranslations } from "use-intl";
import { SCHEMES } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

export function Narrowing() {
  const t = useTranslations("first");
  const { states } = useCheck();
  const live = SCHEMES.filter((s) => states[s.id]?.status !== "out").length;
  return (
    <section className="first-look" aria-live="polite" data-testid="narrowing">
      <div className="lamp" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <h2>{t("stillPossible", { live, total: SCHEMES.length })}</h2>
    </section>
  );
}
