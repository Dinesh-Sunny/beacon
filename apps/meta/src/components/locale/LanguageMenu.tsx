"use client";

// The globe in every header: language picks the words, the country chip picks the rules. Each
// language is written in its own script and says whether a person or a machine translated it.

import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { LOCALES } from "@/i18n/locales";
import { useSetLocale } from "@/i18n/Provider";
import { useMenu } from "./useMenu";

export function LanguageMenu() {
  const t = useTranslations("lang");
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { open, toggle, close, ref } = useMenu();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="btn ghost small"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        aria-label={t("button", { name: current.name })}
        data-testid="lang"
      >
        <Icon name="globe" size={18} />
        <span className="wide-label">{current.name}</span>
      </button>
      {open && (
        <div className="menu lang-menu" role="menu" aria-label={t("menu")}>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === locale}
              lang={l.code}
              dir={l.dir}
              onClick={() => {
                close();
                if (l.code !== locale) setLocale(l.code);
              }}
            >
              <b>{l.name}</b>
              <span lang="en" dir="ltr">
                {l.english} · {l.checked ? t("checked") : t("machine")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
