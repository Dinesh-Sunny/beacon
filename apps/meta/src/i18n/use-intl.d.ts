import type { Locale } from "./locales";
import type { Messages } from "./messages";

// Typed keys and locales for every useTranslations call.
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
