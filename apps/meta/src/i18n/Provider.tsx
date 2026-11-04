"use client";

// Gives every client component the reader's words (use-intl) and a way to change language.
// The choice lives in a cookie so the next server render already speaks it.

import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { IntlProvider } from "use-intl";
import { setLocaleAction } from "./actions";
import { type Locale, localeInfo } from "./locales";
import type { Messages } from "./messages";

const SetLocale = createContext<(l: Locale) => void>(() => {});
export const useSetLocale = () => useContext(SetLocale);

/** The few lines that invite someone to switch, in every language, so the invitation can be
 * written in the language it offers. */
export type Invites = Record<
  Locale,
  { title: string; yes: string; keep: string; why: string }
>;
const InvitesCtx = createContext<Invites | null>(null);
export const useInvites = () => useContext(InvitesCtx);

export function I18nProvider({
  locale,
  messages,
  invites,
  children,
}: {
  locale: Locale;
  messages: Messages;
  invites: Invites;
  children: ReactNode;
}) {
  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem("beacon:lang-chosen", "1");
      if (l !== "en") sessionStorage.setItem("beacon:lang-switched", "1");
    } catch {
      /* fine */
    }
    // The only cookie Beacon sets: the language, for a year. No tracking.
    startTransition(() => setLocaleAction(l));
  }, []);
  // Keeps the page's language and direction in step after a client-side switch.
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en-GB" : locale;
    document.documentElement.dir = localeInfo(locale).dir;
  }, [locale]);
  return (
    <SetLocale.Provider value={setLocale}>
      <InvitesCtx.Provider value={invites}>
        <IntlProvider
          locale={locale}
          messages={messages}
          timeZone="Europe/London"
          // Missing words fall back to English in the merged messages; never crash the page.
          onError={() => {}}
        >
          {children}
        </IntlProvider>
      </InvitesCtx.Provider>
    </SetLocale.Provider>
  );
}
