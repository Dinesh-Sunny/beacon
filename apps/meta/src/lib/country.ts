"use client";

// The country whose rules Beacon uses, kept on this device only. Suggested from the browser's
// language tags (en-GB -> GB), never from location.

import { useCallback, useSyncExternalStore } from "react";
import { countryFromBrowser } from "@/i18n/countries";

const KEY = "beacon:country";
/** Also kept in a cookie, so the server can render pages (counts, examples) for that country. */
export const COUNTRY_COOKIE = "beacon-country";
const writeCookie = (code: string) => {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie
  document.cookie = `${COUNTRY_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
};
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
    writeCookie(code);
    for (const l of listeners) l();
  }, []);
  return { country, setCountry };
}

export const suggestedCountry = (): string | null =>
  typeof navigator === "undefined"
    ? null
    : countryFromBrowser(navigator.languages);

/** Copies a country saved before the cookie existed into the cookie; true if it changed. */
export function syncCountryCookie(): boolean {
  const saved = read();
  if (!saved) return false;
  const has = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COUNTRY_COOKIE}=`))
    ?.split("=")[1];
  if (has === saved) return false;
  writeCookie(saved);
  return true;
}
