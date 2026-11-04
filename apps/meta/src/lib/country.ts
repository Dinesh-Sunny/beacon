"use client";

// The country whose rules Beacon uses, kept on this device only. Suggested from the browser's
// language tags (en-GB -> GB), never from location.

import { useCallback, useSyncExternalStore } from "react";
import { countryFromBrowser } from "@/i18n/countries";

const KEY = "beacon:country";
const listeners = new Set<() => void>();
const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function useCountry() {
  const country = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  const setCountry = useCallback((code: string) => {
    try {
      localStorage.setItem(KEY, code);
    } catch {
      /* fine */
    }
    for (const l of listeners) l();
  }, []);
  return { country, setCountry };
}

export const suggestedCountry = (): string | null =>
  typeof navigator === "undefined"
    ? null
    : countryFromBrowser(navigator.languages);
