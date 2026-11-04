"use client";

// Question, answer and progress wording in the reader's language. English keeps the engine's
// own wording (with its they-form rewrites); other languages read from the messages, and amounts
// and dates are formatted by use-intl for that language.

import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  type Answers,
  ask as askEn,
  currencyOf,
  FACTS,
  type FactId,
  type Money,
  type Subject,
  showAnswer,
  theyify,
  UNSURE,
  type Work,
} from "@/engine/facts";
import { count, type States } from "@/engine/rules";
import { useMaybeCheck } from "@/lib/check-store";

export function useFactText() {
  const locale = useLocale();
  const t = useTranslations();
  const fmt = useFormatter();
  const en = locale === "en";
  const country = useMaybeCheck()?.answers.country;

  const ask = (f: FactId, sub: Subject) =>
    en
      ? askEn(f, sub)
      : sub.who === "me"
        ? t(`facts.${f}.q`)
        : t(`facts.${f}.qThey`, { n: sub.label?.trim() || "?" });
  const why = (f: FactId, sub: Subject) => {
    const us = country === "US" && FACTS[f].whyUs;
    if (en) return theyify(us || FACTS[f].why, sub);
    const key = `facts.${f}.${us ? "whyUs" : "why"}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : t(`facts.${f}.why`);
  };
  const label = (f: FactId) => (en ? FACTS[f].label : t(`facts.${f}.label`));
  const opt = (f: FactId, k: string, fallback: string) => {
    if (en) return fallback;
    const key = `facts.${f}.opts.${k}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : fallback;
  };
  const none = (f: FactId) => {
    const key = `facts.${f}.none` as Parameters<typeof t>[0];
    return en || !t.has(key) ? (FACTS[f].none ?? "") : t(key);
  };
  const money = (n: number) =>
    fmt.number(n, {
      style: "currency",
      currency: currencyOf(country),
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  const month = (iso: string) =>
    fmt.dateTime(new Date(iso), { month: "long", year: "numeric" });

  /** How an answer reads back. */
  const show = (A: Answers, f: FactId): string => {
    if (en) return showAnswer(A, f);
    const v = A[f];
    if (v === undefined) return "";
    if (v === UNSURE) return t("q.notSure");
    if (f === "dob" && A.dobApprox) {
      const age = /\d+/.exec(showAnswer(A, f))?.[0];
      if (age) return t("chips.age", { age });
    }
    const fact = FACTS[f];
    switch (fact.type) {
      case "postcode":
        return String(v).toUpperCase();
      case "zip":
      case "count":
        return String(v);
      case "date":
        return month(String(v));
      case "childDate":
        return v === "none" ? t("q.noChildren") : month(String(v));
      case "money":
        return money(Number(v));
      case "moneyPeriod": {
        const m = v as Money;
        return `${money(m.amt)} ${t("q.per", { per: m.per })}`;
      }
      case "checklist": {
        const list = v as string[];
        return list.length
          ? list
              .map((k) =>
                opt(f, k, fact.opts?.find((o) => o[0] === k)?.[1] ?? k),
              )
              .join(", ")
          : none(f);
      }
      case "work": {
        const w = v as Work;
        return w.status === "employed"
          ? `${t("q.employed")}, ${w.hours ?? 0} ${t("q.hoursWeek").toLowerCase()}`
          : t(`q.${w.status}`);
      }
      case "hours":
        return `${v} ${t("q.hoursWeek").toLowerCase()}`;
      case "yesno":
        return v === "yes" ? t("q.yes") : t("q.no");
      case "choice":
        return opt(
          f,
          String(v),
          fact.opts?.find((o) => o[0] === v)?.[1] ?? String(v),
        );
    }
  };

  /** "3 look likely so far" and friends. */
  const progress = (st: States) => {
    const likely = count(st, "likely");
    const check = count(st, "check");
    if (likely) return t("chat.likelySoFar", { count: likely });
    if (check) return t("chat.checkSoFar", { count: check });
    return count(st, "open")
      ? t("chat.appearAsYouAnswer")
      : t("chat.nothingYet");
  };

  return { ask, why, label, opt, none, show, progress, en };
}
