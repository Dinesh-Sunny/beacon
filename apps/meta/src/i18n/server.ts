import "server-only";

// The reader's language for server-rendered pages: the cookie the language menu sets, else English.
import { cookies, headers } from "next/headers";
import { createTranslator } from "use-intl/core";
import { countryCodes, countryName } from "./countries";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
} from "./locales";
import { MESSAGES } from "./messages";
import type { Country, Invites } from "./Provider";

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

/** A translator for server components, in the reader's language. */
export async function getT() {
  const locale = await getLocale();
  return createTranslator({ locale, messages: MESSAGES[locale] });
}

/** Every country named in the reader's language, sorted for them. */
export const countriesFor = (locale: Locale): Country[] =>
  countryCodes()
    .map((c) => ({ c, name: countryName(c, locale), en: countryName(c, "en") }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, locale === "en" ? "en-GB" : locale),
    );

/** The country the browser's languages name, like en-US -> US. Only tags that say a region
 * count ("en" alone says nothing about where someone lives). Never from location. */
async function browserCountry(): Promise<string | null> {
  const header = (await headers()).get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    if (!tag || tag === "*") continue;
    try {
      const region = new Intl.Locale(tag).region;
      if (region) return region;
    } catch {
      /* skip a bad tag */
    }
  }
  return null;
}

/** The country whose rules Beacon uses: the person's own choice (cookie) first, then what
 * their browser says, then the UK. Only countries Beacon checks are returned. */
export async function getCountry(): Promise<"GB" | "US"> {
  const chosen = (await cookies()).get("beacon-country")?.value;
  if (chosen === "US" || chosen === "GB") return chosen;
  return (await browserCountry()) === "US" ? "US" : "GB";
}
