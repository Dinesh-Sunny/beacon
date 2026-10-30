// Single source of truth for site-wide constants. Values marked TODO need Dinesh before launch.

export const SITE = {
  name: "Beacon",
  tagline: "Find the support that's already yours.",
  description:
    "Free, private check for UK support. Beacon reads the official rules and shows the line behind every answer.",
  /** "Leave this page" goes here and replaces the history entry (design: C-Header). */
  leaveUrl: "https://www.bbc.co.uk/weather",
  /** Shift pressed this many times within the window leaves the page. */
  leaveShiftCount: 3,
  leaveShiftWindowMs: 1200,
  postcodesApi: "https://api.postcodes.io/outcodes/",
  freeHelpUrl: "https://www.citizensadvice.org.uk/",
  // TODO(Dinesh): public repository link, funding line and contact email. Leave null until confirmed.
  repositoryUrl: null as string | null,
  contactEmail: null as string | null,
} as const;

export const LOCALE = "en-GB";

export const formatDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(LOCALE, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
