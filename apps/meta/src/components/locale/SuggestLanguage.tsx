"use client";

// Asked once, from the browser's language setting and never from location: "Read Beacon in
// Polski?" written in Polish. Yes switches every screen; Keep English never asks again here.
// After a switch, one line says how to switch back.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { fromBrowser, type Locale, localeInfo } from "@/i18n/locales";
import { useInvites, useSetLocale } from "@/i18n/Provider";

const store = {
  get: (k: string, s: Storage | undefined) => {
    try {
      return s?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set: (k: string, v: string, s: Storage | undefined) => {
    try {
      s?.setItem(k, v);
    } catch {
      /* fine */
    }
  },
};

export function SuggestLanguage() {
  const locale = useLocale();
  const t = useTranslations("lang");
  const setLocale = useSetLocale();
  const invites = useInvites();
  const [offer, setOffer] = useState<Locale | null>(null);
  const [switched, setSwitched] = useState(false);

  useEffect(() => {
    if (store.get("beacon:lang-switched", sessionStorage)) {
      sessionStorage.removeItem("beacon:lang-switched");
      setSwitched(true);
      return;
    }
    if (locale !== "en" || store.get("beacon:lang-chosen", localStorage))
      return;
    const l = fromBrowser(navigator.languages);
    if (l && l !== "en") setOffer(l);
  }, [locale]);

  if (switched && locale !== "en")
    return (
      <div className="lang-note" role="status">
        <Icon name="globe" size={18} />
        <p>{t("switched", { name: localeInfo(locale).name })}</p>
        <button
          type="button"
          className="linkbtn"
          onClick={() => setLocale("en")}
        >
          {t("back")}
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="OK"
          onClick={() => setSwitched(false)}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  const inv = offer && invites?.[offer];
  if (!offer || !inv) return null;
  const info = localeInfo(offer);
  return (
    <div
      className="lang-note"
      role="dialog"
      aria-label={inv.title}
      lang={offer}
      dir={info.dir}
    >
      <Icon name="globe" size={18} />
      <div>
        <p>
          <b>{inv.title}</b>
        </p>
        <p className="hint" lang="en" dir="ltr">
          {t("suggestWhy")}
        </p>
      </div>
      <button
        type="button"
        className="btn small"
        onClick={() => setLocale(offer)}
      >
        {inv.yes}
      </button>
      <button
        type="button"
        className="btn ghost small"
        lang="en"
        dir="ltr"
        onClick={() => {
          store.set("beacon:lang-chosen", "1", localStorage);
          setOffer(null);
        }}
      >
        {t("keepEnglish")}
      </button>
    </div>
  );
}
