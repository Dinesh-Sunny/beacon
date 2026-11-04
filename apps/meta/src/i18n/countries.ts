// Countries, named by the platform's own Intl data (CLDR) in the reader's language, so the list
// needs no hand-kept table. Coverage says what Beacon can do in each one today.

export type Coverage = "pack" | "none";

/** Countries with a rule pack. Everything else is honest about having none yet. */
export const COVERED: Record<string, { nations: string; coverage: Coverage }> =
  {
    GB: { nations: "England, Scotland, Wales", coverage: "pack" },
  };

// Region codes that name groups, territories filed under another country, or test placeholders.
const NOT_COUNTRIES = new Set(
  "AC CP CQ DG EA IC TA EU EZ UN QO XA XB ZZ".split(" "),
);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let cache: string[] | null = null;
/** Every ISO 3166 country code the platform knows a name for. */
export function countryCodes(): string[] {
  if (cache) return cache;
  const dn = new Intl.DisplayNames(["en"], {
    type: "region",
    fallback: "none",
  });
  const out: string[] = [];
  for (const a of LETTERS)
    for (const b of LETTERS) {
      const code = a + b;
      if (NOT_COUNTRIES.has(code) || !dn.of(code)) continue;
      // Old aliases (UK, BU, DD...) canonicalise to today's code; keep only today's.
      if (Intl.getCanonicalLocales(`und-${code}`)[0]?.split("-")[1] === code)
        out.push(code);
    }
  cache = out;
  return out;
}

export const countryName = (code: string, locale: string): string =>
  new Intl.DisplayNames([locale, "en"], { type: "region" }).of(code) ?? code;

/** A country suggested from the browser's language tags, like en-GB -> GB. Never from location. */
export function countryFromBrowser(langs: readonly string[]): string | null {
  for (const tag of langs) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && countryCodes().includes(region)) return region;
    } catch {
      /* skip a bad tag */
    }
  }
  return null;
}

export const coverageOf = (code: string): Coverage =>
  COVERED[code]?.coverage ?? "none";
