"use client";

// Reads the results out loud with the browser's own speech engine (Web Speech API), for people
// who find long pages hard to read. Nothing leaves the device. Shown only where speech exists.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";

/** A voice for the reader's language (British English for English), local ones first. */
function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  const fits = (v: SpeechSynthesisVoice) =>
    v.lang.toLowerCase() === lang.toLowerCase() ||
    v.lang.toLowerCase().startsWith(`${lang.split("-")[0]}-`);
  return voices.find((v) => fits(v) && v.localService) ?? voices.find(fits);
}

export function ReadAloud({ lines }: { lines: string[] }) {
  const t = useTranslations("read");
  const locale = useLocale();
  const lang = locale === "en" ? "en-GB" : locale;
  const [can, setCan] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setCan(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);
  if (!can) return null;

  const toggle = () => {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    speechSynthesis.cancel();
    const voice = voiceFor(lang);
    // One utterance per line keeps natural pauses and lets Stop cut in quickly.
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.95;
      if (voice) u.voice = voice;
      if (i === lines.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      speechSynthesis.speak(u);
    });
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      className="linkbtn read-aloud"
      onClick={toggle}
      aria-pressed={speaking}
      data-testid="read-aloud"
    >
      <Icon name={speaking ? "stop" : "speaker"} size={16} />{" "}
      {speaking ? t("stop") : t("aloud")}
    </button>
  );
}
