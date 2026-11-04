"use client";

// Place, language and display in one centred search dialog (Figma Kit 10, adopted 30 Oct),
// reached from one small flag button in every header and from the footer. Type to filter,
// Suggested first then everything A to Z, arrows and Enter to choose, Esc to close. It works the
// same for 4 countries or 250. Country and language names come from the platform's Intl data.

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { POSTCODE_RE } from "@/engine/rules";
import { COVERED, flagOf } from "@/i18n/countries";
import { fromBrowser, intlTag, LOCALES, type Locale } from "@/i18n/locales";
import { useCountries, useSetLocale } from "@/i18n/Provider";
import { savePostcodeForLater, useMaybeCheck } from "@/lib/check-store";
import { shortCouncil, usePlace } from "@/lib/council";
import { suggestedCountry, useCountry } from "@/lib/country";
import { useUsPlace } from "@/lib/usplace";
import { DisplayTab } from "./DisplayTab";

export type Tab = "place" | "language" | "display";

/** The one header button: flag, place and language. */
/** A country's name from the server-made list. */
function useNameOf() {
  const list = useCountries();
  return (c: string) => list.find((x) => x.c === c)?.name ?? c;
}

export function PlaceButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("dialog");
  const nameOf = useNameOf();
  const locale = useLocale();
  const { country } = useCountry();
  const check = useMaybeCheck();
  const council = usePlace(check?.answers.postcode).council;
  const us = useUsPlace(check?.answers.zip);
  const [open, setOpen] = useState<Tab | null>(null);
  const code = country ?? "GB";
  const place =
    code === "US" && us.city
      ? `${us.city}, ${us.state}`
      : council
        ? shortCouncil(council.name)
        : nameOf(code);
  const lang = LOCALES.find((l) => l.code === locale)?.name ?? "English";
  return (
    <>
      <button
        type="button"
        className="btn ghost small place-btn"
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        aria-label={t("button", { place, language: lang })}
        onClick={() => setOpen("place")}
        data-testid="place-btn"
      >
        <span aria-hidden="true">{flagOf(code)}</span>
        {!compact && (
          <span className="wide-label">
            {place} - {lang}
          </span>
        )}
        <Icon name="down" size={14} />
      </button>
      {open && <PlaceDialog tab={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The footer link that opens the same dialog. */
export function PlaceFooterLink() {
  const nameOf = useNameOf();
  const locale = useLocale();
  const { country } = useCountry();
  const [open, setOpen] = useState(false);
  const code = country ?? "GB";
  const lang = LOCALES.find((l) => l.code === locale)?.name ?? "English";
  return (
    <>
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
        <span aria-hidden="true">{flagOf(code)}</span> {nameOf(code)} - {lang}
      </button>
      {open && <PlaceDialog tab="place" onClose={() => setOpen(false)} />}
    </>
  );
}

interface Row {
  id: string;
  label: ReactNode;
  aside?: ReactNode;
  current?: boolean;
  pick: () => void;
}

export function PlaceDialog({
  tab: first,
  onClose,
}: {
  tab: Tab;
  onClose: () => void;
}) {
  const t = useTranslations("dialog");
  const locale = useLocale();
  const nameOf = useNameOf();
  const list = useCountries();
  const setLocale = useSetLocale();
  const { country, setCountry } = useCountry();
  const check = useMaybeCheck();
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>(first);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [gap, setGap] = useState<string | null>(null);
  const code = country ?? "GB";
  const listId = useId();
  const pcGuess = q.trim().toUpperCase();
  const isPostcode = tab === "place" && POSTCODE_RE.test(pcGuess);
  const found = usePlace(isPostcode ? pcGuess : undefined);
  const isZip = tab === "place" && /^\d{5}$/.test(pcGuess);
  const foundZip = useUsPlace(isZip ? pcGuess : undefined);
  const mine = usePlace(check?.answers.postcode).council;

  useEffect(() => {
    ref.current?.showModal();
    // Open on the search, like a command palette (showModal would focus the first tab).
    ref.current?.querySelector<HTMLInputElement>(".pd-search input")?.focus();
  }, []);
  // A new tab or search starts at the top of the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on tab or query change
  useEffect(() => {
    setActive(0);
  }, [tab, q]);

  const words = q.trim().toLowerCase();
  const countries = list;

  const chooseCountry = (c: string) => {
    setCountry(c);
    // Say a gap only when it affects them: outside the countries Beacon checks.
    if (!COVERED[c]) setGap(c);
    else close();
  };
  const savePostcode = (pc: string) => {
    if (check) check.apply({ postcode: pc }, "form");
    else savePostcodeForLater(pc);
    setCountry("GB");
    close();
  };
  const saveZip = (zip: string) => {
    setCountry("US");
    if (check) check.apply({ zip }, "form");
    close();
  };
  const close = () => {
    ref.current?.close();
    onClose();
  };

  const suggested: Row[] = [];
  const all: Row[] = [];
  if (tab === "place") {
    if (isPostcode && found.council)
      suggested.push({
        id: "council",
        label: (
          <>
            {shortCouncil(found.council.name)}
            {found.nation && <small> {t(`nation.${found.nation}`)}</small>}
          </>
        ),
        pick: () => savePostcode(pcGuess),
      });
    if (isZip && foundZip.state)
      suggested.push({
        id: "zip",
        label: (
          <>
            {foundZip.city}, {foundZip.state}
            {foundZip.county && <small> {foundZip.county.name}</small>}
          </>
        ),
        pick: () => saveZip(pcGuess),
      });
    const sug = new Set([code, suggestedCountry() ?? "GB"]);
    for (const x of countries) {
      if (
        words &&
        !isPostcode &&
        !`${x.name} ${x.en} ${x.c}`.toLowerCase().includes(words)
      )
        continue;
      if (isPostcode || isZip) continue;
      const row: Row = {
        id: x.c,
        label: (
          <>
            <span aria-hidden="true" className="flag">
              {flagOf(x.c)}
            </span>{" "}
            {x.name}
          </>
        ),
        aside: x.name !== x.en ? x.en : undefined,
        current: x.c === code,
        pick: () => chooseCountry(x.c),
      };
      (sug.has(x.c) && !words ? suggested : all).push(row);
    }
  } else if (tab === "language") {
    const browser =
      typeof navigator === "undefined"
        ? null
        : fromBrowser(navigator.languages);
    const sug = new Set<Locale>([locale, browser ?? "en"]);
    const list = [...LOCALES].sort((a, b) =>
      a.english.localeCompare(b.english),
    );
    for (const l of list) {
      if (words && !`${l.name} ${l.english}`.toLowerCase().includes(words))
        continue;
      const row: Row = {
        id: l.code,
        label: (
          <span lang={l.code} dir={l.dir}>
            {l.name}
          </span>
        ),
        aside: l.code === "en" ? l.english : `${l.english} · ${t("machine")}`,
        current: l.code === locale,
        pick: () => {
          if (l.code !== locale) setLocale(l.code);
          close();
        },
      };
      (sug.has(l.code) && !words ? suggested : all).push(row);
    }
  }
  const rows = [...suggested, ...all];

  const onKey = (e: KeyboardEvent) => {
    if (tab === "display") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[active]?.pick();
    }
  };
  // Keep the highlighted row in view while moving with the arrows.
  useEffect(() => {
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const placeLabel = mine ? shortCouncil(mine.name) : nameOf(code);
  const tabs: [Tab, ReactNode][] = [
    [
      "place",
      <>
        <span aria-hidden="true">{flagOf(code)}</span>{" "}
        {placeLabel ?? t("place")}
      </>,
    ],
    [
      "language",
      <>
        <Icon name="globe" size={16} />{" "}
        {LOCALES.find((l) => l.code === locale)?.name}
      </>,
    ],
    [
      "display",
      <>
        <span aria-hidden="true" className="aa">
          Aa
        </span>{" "}
        {t("display")}
      </>,
    ],
  ];

  const renderRow = (r: Row, i: number) => (
    <li
      key={r.id}
      id={`${listId}-${i}`}
      role="option"
      aria-selected={i === active}
      className={`pd-row${i === active ? " active" : ""}`}
      onPointerMove={() => setActive(i)}
      onClick={r.pick}
      onKeyDown={undefined}
    >
      <span className="pd-label">{r.label}</span>
      {r.aside && <span className="pd-aside">{r.aside}</span>}
      {r.current && <Icon name="check" size={16} label={t("current")} />}
      {i === active && <kbd>enter</kbd>}
    </li>
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes via the dialog's own cancel event
    <dialog
      ref={ref}
      className="place-dialog"
      aria-label={t("title")}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      onKeyDown={onKey}
    >
      <div className="pd-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "on" : ""}
            onClick={() => {
              setTab(k);
              setQ("");
              setGap(null);
              requestAnimationFrame(() =>
                ref.current
                  ?.querySelector<HTMLInputElement>(".pd-search input")
                  ?.focus(),
              );
            }}
            data-testid={`pd-tab-${k}`}
          >
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button
          type="button"
          className="iconbtn"
          aria-label={t("close")}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>

      {tab === "display" ? (
        <DisplayTab onDone={close} />
      ) : gap ? (
        <div className="pd-gap">
          <h2>{t("gapTitle", { country: nameOf(gap) })}</h2>
          <p>{t("gapBody", { country: nameOf(gap) })}</p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => chooseCountry("GB")}
            >
              {t("useUk")}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => chooseCountry("US")}
            >
              {t("useUs")}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setGap(null)}
            >
              {t("chooseAgain")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pd-search">
            <Icon name="search" size={18} />
            <input
              aria-label={
                tab === "place" ? t("searchPlace") : t("searchLanguage")
              }
              placeholder={
                tab === "place" ? t("searchPlace") : t("searchLanguage")
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                rows.length ? `${listId}-${active}` : undefined
              }
              autoComplete="off"
              spellCheck={false}
              data-testid="pd-search"
            />
            <kbd>esc</kbd>
          </div>
          <ul
            id={listId}
            role="listbox"
            className="pd-list"
            aria-label={t("results")}
          >
            {suggested.length > 0 && (
              <li role="presentation" className="pd-group">
                {tab === "place" && isPostcode
                  ? t("yourCouncil")
                  : t("suggested")}
              </li>
            )}
            {suggested.map((r, i) => renderRow(r, i))}
            {all.length > 0 && (
              <li role="presentation" className="pd-group">
                {tab === "place" ? t("allCountries") : t("allLanguages")}
              </li>
            )}
            {all.map((r, i) => renderRow(r, suggested.length + i))}
            {!rows.length && (
              <li role="presentation" className="pd-empty">
                {isPostcode ? t("lookingUp") : t("noMatch")}
              </li>
            )}
          </ul>
          {tab === "place" && <p className="pd-note">{t("placeNote")}</p>}
        </>
      )}
      {tab !== "display" && (
        <div className="pd-foot" aria-hidden="true">
          <kbd>arrows</kbd> {t("move")} <kbd>enter</kbd> {t("choose")}{" "}
          <kbd>esc</kbd> {t("closeKey")}
        </div>
      )}
    </dialog>
  );
}
