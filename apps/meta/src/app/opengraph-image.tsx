// The picture shown when a Beacon link is shared, drawn by next/og ImageResponse from the same
// numbers the site shows. Fonts are the site's own (Atkinson Hyperlegible), read once.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SCHEMES } from "@/engine/rules";
import { LOCALES } from "@/i18n/locales";

export const alt = "Beacon - find the support that's already yours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (w: number) =>
  readFile(
    join(
      process.cwd(),
      `node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff`,
    ),
  );
const [regular, bold] = await Promise.all([font(400), font(700)]);

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#F4EFE7",
        color: "#1F1B16",
        fontFamily: "Atkinson",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "#F5A524",
            boxShadow: "0 0 0 14px rgba(245,165,36,0.18)",
          }}
        />
        <div style={{ fontSize: 40, fontWeight: 700 }}>Beacon</div>
      </div>
      <div
        style={{
          fontSize: 76,
          fontWeight: 700,
          lineHeight: 1.05,
          maxWidth: 980,
        }}
      >
        Find the support that's already yours.
      </div>
      <div style={{ display: "flex", gap: 36, fontSize: 30, color: "#6B6257" }}>
        <span>{SCHEMES.length} kinds of help</span>
        <span>UK and US</span>
        <span>{LOCALES.length} languages</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Atkinson", data: regular, weight: 400, style: "normal" },
        { name: "Atkinson", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
