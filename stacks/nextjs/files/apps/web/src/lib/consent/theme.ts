import type { Theme } from "@c15t/nextjs";

// The banner and dialog read our design tokens through CSS variables, so a client project's
// rebrand (globals.css) restyles them too, light and dark.
export const CONSENT_THEME = {
  colors: {
    primary: "var(--primary)",
    primaryHover: "color-mix(in oklab, var(--primary) 88%, var(--foreground))",
    surface: "var(--popover)",
    surfaceHover: "var(--accent)",
    border: "var(--border)",
    borderHover: "var(--input)",
    text: "var(--popover-foreground)",
    textMuted: "var(--muted-foreground)",
    textOnPrimary: "var(--primary-foreground)",
    overlay: "color-mix(in oklab, var(--foreground) 40%, transparent)",
    switchTrack: "var(--input)",
    switchTrackActive: "var(--primary)",
    switchThumb: "var(--background)",
  },
  // Our own utility classes rather than font literals: site font, heading font on titles, and
  // titles a step above the description so the hierarchy reads like the rest of the site.
  slots: {
    consentBannerCard: "font-sans",
    consentDialogCard: "font-sans",
    consentBannerTitle: "font-heading text-base",
    consentBannerDescription: "text-sm",
    consentDialogTitle: "font-heading text-lg",
    consentDialogDescription: "text-sm",
    // 44px touch targets on touch screens, like the rest of the site's buttons.
    buttonPrimary: "pointer-coarse:min-h-11",
    buttonSecondary: "pointer-coarse:min-h-11",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
  },
} satisfies Theme;
