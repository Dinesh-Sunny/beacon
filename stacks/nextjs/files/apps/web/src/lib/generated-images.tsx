import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE } from "@/lib/og";
import { SITE, SITE_URL } from "@/lib/site";
import { themeColor } from "@/lib/theme-colors";

// Shared renderers for opengraph-image and icon routes, so each page gets its own title on a
// consistent card. Satori lays out a fixed 1200x630 canvas with inline styles only (no classes,
// no CSS variables), so sizes are canvas pixels and colors come from theme-colors.
export { OG_IMAGE_SIZE } from "@/lib/og";
export const PNG_CONTENT_TYPE = "image/png";

const LAYOUT = {
  padding: 80,
  accentWidth: 16,
  eyebrowSize: 32,
  titleSize: 68,
  footerSize: 28,
  gap: 28,
  // Titles come from page metadata and can run long; clamp so they never spill off the card.
  titleMaxLines: 4,
};

const SINGLE_LINE = {
  display: "block",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

// `eyebrow` names the site and `footer` shows its host; both default to the base site.
type OgImageInput = { title: string; eyebrow?: string; footer?: string };

export function renderOgImage({
  title,
  eyebrow = SITE.name,
  footer = SITE_URL.host,
}: OgImageInput): ImageResponse {
  const colors = {
    background: themeColor("background"),
    foreground: themeColor("foreground"),
    muted: themeColor("muted-foreground"),
    primary: themeColor("primary"),
  };

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: colors.background,
      }}
    >
      <div
        style={{
          width: LAYOUT.accentWidth,
          height: "100%",
          background: colors.primary,
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: LAYOUT.padding,
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap }}
        >
          <div
            style={{
              ...SINGLE_LINE,
              fontSize: LAYOUT.eyebrowSize,
              color: colors.primary,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "block",
              lineClamp: LAYOUT.titleMaxLines,
              fontSize: LAYOUT.titleSize,
              color: colors.foreground,
              lineHeight: 1.15,
              textWrap: "balance",
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            ...SINGLE_LINE,
            fontSize: LAYOUT.footerSize,
            color: colors.muted,
          }}
        >
          {footer}
        </div>
      </div>
    </div>,
    OG_IMAGE_SIZE,
  );
}

const ICON_GLYPH_RATIO = 0.62;
const ICON_RADIUS_RATIO = 0.22;

type IconInput = { width: number; height: number; rounded: boolean };

// App icon: the product initial on the primary token, scaled to whatever size the route asks for.
// Apple icons stay square because iOS applies its own mask (transparent corners turn black).
export function renderIcon({ rounded, ...size }: IconInput): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: themeColor("primary"),
        color: themeColor("primary-foreground"),
        fontSize: size.height * ICON_GLYPH_RATIO,
        borderRadius: rounded ? size.height * ICON_RADIUS_RATIO : 0,
      }}
    >
      {SITE.name.charAt(0)}
    </div>,
    size,
  );
}
