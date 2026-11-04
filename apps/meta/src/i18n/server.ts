import "server-only";

// The reader's language for server-rendered pages: the cookie the language menu sets, else English.
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
} from "./locales";
import { MESSAGES } from "./messages";
import type { Invites } from "./Provider";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export const messagesFor = (locale: Locale) => MESSAGES[locale];

/** The switch invitation in every language, each with its own language's name. */
export const invites = (): Invites =>
  Object.fromEntries(
    LOCALES.map((l) => {
      const m = MESSAGES[l.code].lang;
      const fill = (s: string) => s.replaceAll("{name}", l.name);
      return [
        l.code,
        {
          title: fill(m.suggestTitle),
          yes: fill(m.suggestYes),
          keep: m.keepEnglish,
          why: m.suggestWhy,
        },
      ];
    }),
  ) as Invites;
