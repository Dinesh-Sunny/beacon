"use client";

// One way to speak for the whole app (Web Speech API): read aloud, auto-read and the display
// preview all go through here, so the chosen speed, the language's voice and captions apply
// everywhere. Nothing leaves the device.

import { useSyncExternalStore } from "react";
import { speechRate } from "./display";

let caption = "";
const listeners = new Set<() => void>();
const setCaption = (c: string) => {
  caption = c;
  for (const l of listeners) l();
};

/** The line being spoken right now, for the captions bar. */
export const useCaption = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => caption,
    () => "",
  );

export const canSpeak = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/** A voice for the language (British English for English), local voices first. */
function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  const base = lang.split("-")[0]?.toLowerCase() ?? "en";
  const fits = (v: SpeechSynthesisVoice) =>
    v.lang.toLowerCase() === lang.toLowerCase() ||
    v.lang.toLowerCase().startsWith(`${base}-`);
  return voices.find((v) => fits(v) && v.localService) ?? voices.find(fits);
}

/** Speaks the lines in order; resolves when done or stopped. */
export function speak(lines: string[], lang: string): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  speechSynthesis.cancel();
  const voice = voiceFor(lang);
  return new Promise((done) => {
    const texts = lines.filter((l) => l.trim());
    if (!texts.length) return done();
    texts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.95 * speechRate();
      if (voice) u.voice = voice;
      u.onstart = () => setCaption(text);
      const end = () => {
        if (i === texts.length - 1) {
          setCaption("");
          done();
        }
      };
      u.onend = end;
      u.onerror = () => {
        setCaption("");
        done();
      };
      speechSynthesis.speak(u);
    });
  });
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
  setCaption("");
}
