import { type Token, themeColor } from "@/lib/theme-colors";

// Email clients ignore CSS variables, so React Email's Tailwind compiles these hex values into
// inline styles. They come from globals.css, so `bg-primary` in an email matches the site.
const EMAIL_TOKENS = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "muted",
  "muted-foreground",
  "border",
] as const satisfies ReadonlyArray<Token>;

// Email can't load next/font, so each role names the site font first (used where installed) and
// a font every mail client has as the fallback. Mirrors the roles in lib/fonts.ts.
const EMAIL_FONTS = {
  sans: "Inter, Helvetica, Arial, sans-serif",
  heading: "Merriweather, Georgia, serif",
} as const;

export const EMAIL_THEME = `@theme {\n${[
  ...EMAIL_TOKENS.map((token) => `  --color-${token}: ${themeColor(token)};`),
  ...Object.entries(EMAIL_FONTS).map(
    ([role, stack]) => `  --font-${role}: ${stack};`,
  ),
].join("\n")}\n}`;
