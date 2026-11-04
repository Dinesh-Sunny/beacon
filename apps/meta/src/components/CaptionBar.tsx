"use client";

// Captions for anything Beacon reads aloud, shown when the Captions setting is on.
import { useTranslations } from "use-intl";
import { useDisplay } from "@/lib/display";
import { useCaption } from "@/lib/speech";

export function CaptionBar() {
  const line = useCaption();
  const { display } = useDisplay();
  const t = useTranslations("display");
  if (!line || !display.on.includes("captions")) return null;
  return (
    <div
      className="caption-bar"
      role="status"
      aria-label={t("setting.captions")}
    >
      {line}
    </div>
  );
}
