"use client";

// Reads the results out loud through the shared speech helper (Web Speech API), at the person's
// chosen speed and in their language's voice, with captions when they're on. Nothing leaves the
// device. Shown only where speech exists.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { intlTag } from "@/i18n/locales";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech";

export function ReadAloud({ lines }: { lines: string[] }) {
  const t = useTranslations("read");
  const locale = useLocale();
  const [can, setCan] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setCan(canSpeak());
    return () => stopSpeaking();
  }, []);
  if (!can) return null;
  const toggle = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speak(lines, intlTag(locale));
    setSpeaking(false);
  };
  return (
    <button
      type="button"
      className="linkbtn read-aloud"
      onClick={() => void toggle()}
      aria-pressed={speaking}
      data-testid="read-aloud"
    >
      <Icon name={speaking ? "stop" : "speaker"} size={16} />{" "}
      {speaking ? t("stop") : t("aloud")}
    </button>
  );
}
