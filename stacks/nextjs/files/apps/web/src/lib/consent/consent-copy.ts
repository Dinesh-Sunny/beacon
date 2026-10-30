import type { C15TOptions } from "@c15t/backend";
import { SITE } from "@/lib/site";

type Translations = NonNullable<C15TOptions["customTranslations"]>[string];

// Where visitors change their choice: the dialog title and every link that opens it.
export const COOKIE_SETTINGS_LABEL = "Cookie settings";

// Banner and dialog words, served by the consent backend to every client. Follows VOICE.md:
// plain, second person, buttons say what happens. Accept and reject carry the same weight.
export const CONSENT_COPY: Translations = {
  common: {
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    customize: "Choose",
    save: "Save choices",
    close: "Close",
  },
  cookieBanner: {
    title: `Cookies on ${SITE.name}`,
    description: `Some cookies keep the site working, like keeping you signed in. With your permission we also measure how the site is used, so we can fix what's slow or confusing. Change your mind any time in ${COOKIE_SETTINGS_LABEL}.`,
  },
  consentManagerDialog: {
    title: COOKIE_SETTINGS_LABEL,
    description:
      "Choose what we can use. Strictly necessary cookies are always on: without them you can't sign in or keep this choice.",
  },
  consentTypes: {
    necessary: {
      title: "Strictly necessary",
      description: "Sign-in, security, and remembering your cookie choice.",
    },
    measurement: {
      title: "Measurement",
      description:
        "Counts visits and clicks so we can see which pages work. If you're signed in, it's linked to your account id, never your email.",
    },
    marketing: {
      title: "Marketing",
      description:
        "Lets ad platforms tell us which ads led to a visit or a sign-up.",
    },
  },
};
