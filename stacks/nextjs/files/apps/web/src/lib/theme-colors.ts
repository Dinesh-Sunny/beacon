import { readFileSync } from "node:fs";
import { join } from "node:path";

// Generated images (OG cards, icons), emails, and the manifest can't read CSS variables, so this pulls
// the real values out of globals.css (the token source of truth) and converts oklch to hex.
const GLOBALS_CSS = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

type Scheme = "light" | "dark";
const SCHEME_SELECTOR: Record<Scheme, string> = {
  light: ":root",
  dark: ".dark",
};

export type Token =
  | "background"
  | "foreground"
  | "primary"
  | "primary-foreground"
  | "muted"
  | "muted-foreground"
  | "border";

function readToken(scheme: Scheme, token: Token): string {
  const block = GLOBALS_CSS.match(
    new RegExp(
      `^${escapeRegExp(SCHEME_SELECTOR[scheme])}\\s*\\{([^}]*)\\}`,
      "m",
    ),
  )?.[1];
  const value = block
    ?.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]
    ?.trim();
  if (!value) {
    throw new Error(`Token --${token} not found in ${SCHEME_SELECTOR[scheme]}`);
  }
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// OKLCH -> linear sRGB -> gamma-encoded sRGB, per Björn Ottosson's reference matrices.
function oklchToHex(value: string): string {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`Unsupported color token value: ${value}`);
  const [lightness, chroma, hue] = match.slice(1).map(Number);
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return `#${linear.map(toHexChannel).join("")}`;
}

function toHexChannel(channel: number): string {
  const encoded =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  return byte.toString(16).padStart(2, "0");
}

export function themeColor(token: Token, scheme: Scheme = "light"): string {
  return oklchToHex(readToken(scheme, token));
}
