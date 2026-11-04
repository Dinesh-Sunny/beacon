"use client";

// Reads the results out loud with the browser's own speech engine (Web Speech API), for people
// who find long pages hard to read. Nothing leaves the device. Shown only where speech exists.

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/** Picks a British English voice when the device has one. */
function ukVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-GB" && v.localService) ??
    voices.find((v) => v.lang === "en-GB")
  );
}

export function ReadAloud({ lines }: { lines: string[] }) {
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
    const voice = ukVoice();
    // One utterance per line keeps natural pauses and lets Stop cut in quickly.
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
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
      {speaking ? "Stop reading" : "Read aloud"}
    </button>
  );
}
