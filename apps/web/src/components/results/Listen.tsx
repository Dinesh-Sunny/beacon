"use client";

import { useEffect, useState } from "react";
import { LOCALE } from "@/lib/site";
import { Icon } from "../Icon";

/** Reads a result aloud with the browser's own speech (nothing leaves the device). Hidden where unsupported. */
export function Listen({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported("speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const toggle = (): void => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      className="btn sec self-start no-print"
      aria-pressed={speaking}
      onClick={toggle}
    >
      <Icon name={speaking ? "stop" : "volume"} />
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
