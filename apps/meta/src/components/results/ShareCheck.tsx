"use client";

// Share this check with family or an adviser. Uses the phone's own share sheet when there is
// one (Web Share API), otherwise copies the link. The answers travel in the link itself.

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { useCheck } from "@/lib/check-store";
import { shareLink } from "@/lib/share";

export function ShareCheck() {
  const t = useTranslations("share");
  const { answers, subject } = useCheck();
  const [note, setNote] = useState("");
  const share = async () => {
    const url = await shareLink(answers, subject);
    const title =
      subject.who === "me"
        ? t("titleMe")
        : t("titleThey", { name: subject.label ?? "" });
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({
          title,
          text: t("text"),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote(t("copied"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote(t("failed"));
    }
  };
  return (
    <>
      <button
        type="button"
        className="btn ghost small"
        onClick={() => void share()}
        data-testid="share"
      >
        <Icon name="share" size={16} /> {t("button")}
      </button>
      {note && (
        <p className="hint" role="status">
          {note}
        </p>
      )}
    </>
  );
}
