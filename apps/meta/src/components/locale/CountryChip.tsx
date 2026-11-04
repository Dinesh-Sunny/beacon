"use client";

// The country chip in every header and the place picker behind it. Country first, then the
// council area from the postcode - never an address. Countries are named by the platform's own
// Intl data in the reader's language. Only countries with a rule pack can be checked; for the
// rest Beacon says so plainly instead of guessing.

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import {
  COVERED,
  countryCodes,
  countryName,
  coverageOf,
} from "@/i18n/countries";
import { useCheck } from "@/lib/check-store";
import { shortCouncil, useCouncil } from "@/lib/council";
import { suggestedCountry, useCountry } from "@/lib/country";

type Step = "suggest" | "list" | "none";

export function CountryChip() {
  const t = useTranslations("place");
  const locale = useLocale();
  const { country, setCountry } = useCountry();
  const { answers } = useCheck();
  const council = useCouncil(answers.postcode);
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("list");
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const code = country ?? "GB";

  const open = (s: Step) => {
    setStep(s);
    setQ("");
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  // Opening the picker for the first time offers the browser's country, then the full list.
  const start = () => {
    const s = country ? null : suggestedCountry();
    if (s && s !== code) {
      setPick(s);
      open("suggest");
    } else open("list");
  };

  const all = useMemo(
    () =>
      countryCodes()
        .map((c) => ({
          c,
          name: countryName(c, locale),
          en: countryName(c, "en"),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [locale],
  );
  const words = q.trim().toLowerCase();
  const match = (x: { c: string; name: string; en: string }) =>
    !words ||
    x.name.toLowerCase().includes(words) ||
    x.en.toLowerCase().includes(words) ||
    x.c.toLowerCase() === words;
  const withPack = all.filter((x) => COVERED[x.c] && match(x));
  const others = all.filter((x) => !COVERED[x.c] && match(x));

  const choose = (c: string) => {
    if (coverageOf(c) === "pack") {
      setCountry(c);
      close();
    } else {
      setPick(c);
      setStep("none");
    }
  };
  const covered = Object.keys(COVERED)
    .map((c) => countryName(c, locale))
    .join(", ");
  const name = (c: string) => countryName(c, locale);

  return (
    <>
      <button
        type="button"
        className="btn ghost small country-chip"
        onClick={start}
        aria-label={t("chip", { country: name(code) })}
        data-testid="country"
      >
        <b>{code === "GB" ? "UK" : code}</b>
        {council && (
          <span className="wide-label">{shortCouncil(council.name)}</span>
        )}
      </button>
      <dialog ref={dialog} className="place-picker" aria-labelledby="place-h">
        <div className="pp-head">
          <span className="eyebrow">
            {t("step", {
              n: step === "suggest" ? 1 : step === "list" ? 2 : 3,
              total: 3,
            })}
          </span>
          <button
            type="button"
            className="iconbtn"
            aria-label={t("close")}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        {step === "suggest" && pick && (
          <>
            <h2 id="place-h">{t("suggest", { country: name(pick) })}</h2>
            <p className="hint">{t("never")}</p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => choose(pick)}
              >
                {t("yes")}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setStep("list")}
              >
                {t("other")}
              </button>
            </div>
          </>
        )}
        {step === "list" && (
          <>
            <h2 id="place-h">{t("which")}</h2>
            <label className="sr-only" htmlFor="pp-q">
              {t("search")}
            </label>
            <input
              id="pp-q"
              className="txt"
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="country-name"
            />
            <div className="pp-list">
              {withPack.length > 0 && (
                <span className="eyebrow">{t("withPack")}</span>
              )}
              {withPack.map((x) => (
                <button
                  key={x.c}
                  type="button"
                  className="pp-row"
                  onClick={() => choose(x.c)}
                  aria-current={x.c === code}
                >
                  <b className="pp-code">{x.c === "GB" ? "UK" : x.c}</b>
                  <span>
                    {x.name}
                    <small>{COVERED[x.c]?.nations}</small>
                  </span>
                  <em className="badge-pack" title={t("packLine")}>
                    {t("packBadge")}
                  </em>
                </button>
              ))}
              <span className="eyebrow">{t("others")}</span>
              {others.map((x) => (
                <button
                  key={x.c}
                  type="button"
                  className="pp-row"
                  onClick={() => choose(x.c)}
                >
                  <b className="pp-code">{x.c}</b>
                  <span>
                    {x.name}
                    {x.name !== x.en && <small>{x.en}</small>}
                  </span>
                  <em className="badge-none">{t("noneBadge")}</em>
                </button>
              ))}
            </div>
          </>
        )}
        {step === "none" && pick && (
          <>
            <h2 id="place-h">{t("noneTitle", { country: name(pick) })}</h2>
            <p>{t("noneBody", { country: name(pick), covered })}</p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCountry("GB");
                  close();
                }}
              >
                {t("useUk")}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setStep("list")}
              >
                {t("back")}
              </button>
            </div>
          </>
        )}
        {step === "list" && code === "GB" && (
          <p className="hint pp-foot">{t("ukPlace")}</p>
        )}
      </dialog>
    </>
  );
}
