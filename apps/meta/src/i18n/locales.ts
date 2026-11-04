// The languages Beacon's words come in. Each is named in its own script so people can find
// theirs. Language picks the words; the country picks the rules (see countries.ts).

export const LOCALES = [
  {
    code: "en",
    name: "English",
    english: "English",
    dir: "ltr",
    checked: true,
  },
  { code: "cy", name: "Cymraeg", english: "Welsh", dir: "ltr", checked: false },
  { code: "pl", name: "Polski", english: "Polish", dir: "ltr", checked: false },
  {
    code: "es",
    name: "Español",
    english: "Spanish",
    dir: "ltr",
    checked: false,
  },
  { code: "bn", name: "বাংলা", english: "Bengali", dir: "ltr", checked: false },
  { code: "ur", name: "اردو", english: "Urdu", dir: "rtl", checked: false },
  {
    code: "ar",
    name: "العربية",
    english: "Arabic",
    dir: "rtl",
    checked: false,
  },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "beacon-lang";

export const isLocale = (x: unknown): x is Locale =>
  LOCALES.some((l) => l.code === x);
export const localeInfo = (code: Locale) =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];

/** The first supported language in the browser's own list (never from location). */
export function fromBrowser(langs: readonly string[]): Locale | null {
  for (const tag of langs) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}
