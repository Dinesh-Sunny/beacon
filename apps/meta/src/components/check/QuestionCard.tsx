"use client";

// The question card: each fact type draws its own input, and the facts code works out from the
// answer appear underneath as you type, so the person sees why the question matters.

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { AnswersSchema } from "@/engine/answers-schema";
import {
  type Answers,
  ask,
  FACTS,
  type FactId,
  type Money,
  optLabel,
  type Period,
  theyify,
  UNSURE,
  type Work,
  type WorkStatus,
} from "@/engine/facts";
import { chips, derive, POSTCODE_RE, SCHEMES } from "@/engine/rules";
import { useFactText } from "@/i18n/useFactText";
import { useCheck } from "@/lib/check-store";

interface Draft {
  pc?: string;
  m?: string;
  y?: string;
  amt?: string;
  per?: Period;
  sel?: string[];
  status?: WorkStatus;
  hours?: string;
  h?: string;
}

/** Errors are message ids under "q", worded in the reader's language when shown. */
type ErrId =
  | "errFit"
  | "errPostcode"
  | "errYear"
  | "errFuture"
  | "errAmount"
  | "errHours"
  | "errHoursRange"
  | "errZip"
  | "errCount";
type Read = { v: Answers[FactId] } | { err: ErrId } | { empty: true };
type RawRead = { v: unknown } | { err: ErrId } | { empty: true };

/** Reads the inputs, then lets the answers schema have the final say on the value's shape. */
function readDraft(f: FactId, x: Draft, today = new Date()): Read {
  const r = readRaw(f, x, today);
  if (!("v" in r)) return r;
  const parsed = AnswersSchema.shape[f].safeParse(r.v);
  return parsed.success ? { v: parsed.data } : { err: "errFit" };
}

function readRaw(f: FactId, x: Draft, today: Date): RawRead {
  const t = FACTS[f].type;
  if (t === "postcode") {
    const v = (x.pc ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    if (!v) return { empty: true };
    if (!POSTCODE_RE.test(v)) return { err: "errPostcode" };
    return { v };
  }
  if (t === "date" || t === "childDate") {
    // Month and year only: Beacon never keeps a full date of birth.
    if (!x.m && !x.y) return { empty: true };
    const yy = Number(x.y);
    const mm = Number(x.m || 7);
    if (!yy || yy < 1900 || yy > today.getFullYear()) return { err: "errYear" };
    if (new Date(yy, mm - 1, 1) > today) return { err: "errFuture" };
    return { v: `${yy}-${String(mm).padStart(2, "0")}-15` };
  }
  if (t === "money" || t === "moneyPeriod") {
    const raw = String(x.amt ?? "").replace(/[£$,\s]/g, "");
    if (!raw) return { empty: true };
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n) || n < 0) return { err: "errAmount" };
    return t === "money" ? { v: n } : { v: { amt: n, per: x.per ?? "week" } };
  }
  if (t === "checklist") {
    if (!x.sel) return { empty: true };
    return { v: x.sel };
  }
  if (t === "work") {
    if (!x.status) return { empty: true };
    if (x.status === "employed") {
      const h = Number(x.hours);
      if (!(h > 0)) return { err: "errHours" };
      return { v: { status: "employed", hours: h } };
    }
    return { v: { status: x.status } };
  }
  if (t === "hours") {
    const n = Number(x.h ?? 0);
    if (Number.isNaN(n) || n < 0 || n > 168) return { err: "errHoursRange" };
    return { v: n };
  }
  if (t === "zip") {
    const v = (x.pc ?? "").trim();
    if (!v) return { empty: true };
    return /^\d{5}$/.test(v) ? { v } : { err: "errZip" };
  }
  if (t === "count") {
    const n = Number(x.h ?? 0);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { err: "errCount" };
    return { v: n };
  }
  return { empty: true };
}

export function QuestionCard({
  f,
  onAnswer,
  inChat,
}: {
  f: FactId;
  onAnswer?: (f: FactId, v: Answers[FactId], extra?: Answers) => void;
  inChat?: boolean;
}) {
  const { answers, apply, states, edit, skip, skipped, subject } = useCheck();
  const t = useTranslations("q");
  const tChip = useTranslations("chips");
  const tn = useTranslations("nations");
  const ft = useFactText();
  const editing = !inChat;
  const [draft, setDraft] = useState<Draft>({});
  const [err, setErr] = useState("");
  const body = useRef<HTMLDivElement>(null);

  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the question changes
  useEffect(() => {
    setDraft(editing ? toDraft(f, answers[f]) : {});
    setErr("");
    // Move focus to the new question after an answer, not on first load.
    if (first.current) first.current = false;
    else
      body.current
        ?.querySelector<HTMLElement>("input, button")
        ?.focus({ preventScroll: true });
  }, [f]);

  const fact = FACTS[f];
  const hits = SCHEMES.filter(
    (s) => states[s.id]?.status === "open" && states[s.id]?.unknown.includes(f),
  );
  const set = (patch: Draft) => {
    setErr("");
    setDraft((d) => ({ ...d, ...patch }));
  };
  const r = readDraft(f, draft);
  // A new postcode is previewed on its own letters, not the nation looked up for the old one.
  const preview =
    "v" in r
      ? chips(
          f,
          derive({
            ...answers,
            ...(f === "postcode" ? { nation: undefined } : {}),
            [f]: r.v,
          }),
        )
      : [];
  // A birth year without a month is kept as approximate, so it reads back as an age.
  const extra: Answers = f === "dob" && !draft.m ? { dobApprox: true } : {};
  const save = (v: Answers[FactId]) =>
    onAnswer ? onAnswer(f, v, extra) : apply({ [f]: v, ...extra }, "form");
  const submit = (value?: Answers[FactId]) => {
    if (value !== undefined) return save(value);
    if ("err" in r) return setErr(t(r.err));
    if ("empty" in r) return setErr(t(emptyHint(fact.type)));
    save(r.v);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      submit();
    }
  };
  const instant = ["yesno", "choice"].includes(fact.type);
  const canSkip = !editing && !skipped.includes(f);

  return (
    <section
      className={`qcard${inChat ? " in-chat" : ""}`}
      aria-labelledby={inChat ? "q-chat" : "q-title"}
      data-testid={inChat ? "chat-question" : "question"}
      data-fact={f}
    >
      {editing && (
        <div className="qtop">
          <span className="eyebrow">
            {answers[f] === undefined ? t("answerHere") : t("change")}
          </span>
        </div>
      )}
      <h2 id={inChat ? "q-chat" : "q-title"}>{ft.ask(f, subject)}</h2>
      <p className="why">{ft.why(f, subject)}</p>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Enter anywhere in the inputs saves; the inputs themselves are the controls */}
      <div ref={body} onKeyDown={onKey} className="qbody">
        <Input
          f={f}
          idp={inChat ? "c" : "d"}
          draft={draft}
          set={set}
          submit={submit}
        />
      </div>

      {!instant && (
        <div className="derived" aria-live="polite">
          {preview.map((c) => (
            <span key={c.id}>
              {tChip(c.id, {
                ...c.v,
                ...(c.v?.nation ? { nation: tn(c.v.nation as "eng") } : {}),
              })}
            </span>
          ))}
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <button
        type="button"
        className="linkbtn unsure"
        onClick={() => submit(UNSURE)}
        data-testid="unsure"
      >
        {t("unsure")}
      </button>
      <div className="qactions">
        {!instant && (
          <button
            type="button"
            className="btn"
            onClick={() => submit()}
            data-testid="continue"
          >
            {t("save")}
          </button>
        )}
        {editing ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => edit(null)}
          >
            {t("cancel")}
          </button>
        ) : canSkip ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => skip(f)}
            data-testid="skip"
          >
            {t("skip")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Fills the card with the saved answer when someone changes it. */
function toDraft(f: FactId, v: unknown): Draft {
  if (v === undefined || v === UNSURE) return {};
  const t = FACTS[f].type;
  if (t === "postcode" || t === "zip") return { pc: String(v) };
  if (t === "count") return { h: String(v) };
  if (
    (t === "date" || t === "childDate") &&
    typeof v === "string" &&
    v !== "none"
  ) {
    const [y, m] = v.split("-");
    return { y, m: String(Number(m)) };
  }
  if (t === "money") return { amt: String(v) };
  if (t === "moneyPeriod")
    return { amt: String((v as Money).amt), per: (v as Money).per };
  if (t === "checklist") return { sel: v as string[] };
  if (t === "work")
    return {
      status: (v as Work).status,
      hours: (v as Work).hours ? String((v as Work).hours) : undefined,
    };
  if (t === "hours") return { h: String(v) };
  return {};
}

function emptyHint(t: string) {
  if (t === "checklist") return "emptyChecklist" as const;
  if (t === "work") return "emptyWork" as const;
  return "emptyOther" as const;
}

function Input({
  f,
  idp,
  draft,
  set,
  submit,
}: {
  f: FactId;
  idp: string;
  draft: Draft;
  set: (p: Draft) => void;
  submit: (v?: Answers[FactId]) => void;
}) {
  const { subject, answers } = useCheck();
  const t = useTranslations("q");
  const fmt = useFormatter();
  const ft = useFactText();
  const fact = FACTS[f];
  // Month names in the reader's language, from the platform.
  const months = Array.from({ length: 12 }, (_, i) =>
    fmt.dateTime(new Date(2026, i, 1), { month: "long" }),
  );
  switch (fact.type) {
    case "postcode":
      return (
        <div className="field">
          <label htmlFor={`${idp}-pc`}>{t("postcode")}</label>
          <input
            id={`${idp}-pc`}
            className="txt"
            style={{ maxWidth: "12ch", textTransform: "uppercase" }}
            autoComplete="postal-code"
            spellCheck={false}
            value={draft.pc ?? ""}
            onChange={(e) => set({ pc: e.target.value })}
          />
        </div>
      );
    case "date":
    case "childDate":
      return (
        <>
          {fact.type === "childDate" && (
            <button
              type="button"
              className="rc"
              onClick={() => submit("none")}
              data-testid="no-children"
            >
              {t("noChildren")}
            </button>
          )}
          <div className="dates">
            <div className="field">
              <label htmlFor={`${idp}-m`}>{t("month")}</label>
              <select
                id={`${idp}-m`}
                className="txt"
                value={draft.m ?? ""}
                onChange={(e) => set({ m: e.target.value })}
              >
                <option value="">{t("notSure")}</option>
                {months.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field y">
              <label htmlFor={`${idp}-y`}>{t("year")}</label>
              <input
                id={`${idp}-y`}
                className="txt"
                inputMode="numeric"
                maxLength={4}
                placeholder={fact.type === "childDate" ? "2021" : "1948"}
                value={draft.y ?? ""}
                onChange={(e) => set({ y: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>
        </>
      );
    case "money":
    case "moneyPeriod":
      return (
        <>
          <div className="field">
            <label htmlFor={`${idp}-amt`}>
              {fact.type === "moneyPeriod" ? t("amountAfterTax") : t("amount")}
            </label>
            <div className="money">
              <span>{answers.country === "US" ? "$" : "£"}</span>
              <input
                id={`${idp}-amt`}
                className="txt"
                inputMode="decimal"
                value={draft.amt ?? ""}
                onChange={(e) => set({ amt: e.target.value })}
              />
            </div>
          </div>
          {fact.type === "moneyPeriod" && (
            <fieldset className="seg">
              <legend className="sr-only">{t("howOften")}</legend>
              {(["week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={(draft.per ?? "week") === p}
                  onClick={() => set({ per: p })}
                >
                  {t("per", { per: p })}
                </button>
              ))}
            </fieldset>
          )}
        </>
      );
    case "checklist":
      return (
        <div className="checks">
          {fact.opts?.map(([v, label]) => (
            <label key={v} className="chk">
              <input
                type="checkbox"
                checked={Boolean(draft.sel?.includes(v))}
                onChange={(e) => {
                  const s = new Set(draft.sel ?? []);
                  if (e.target.checked) s.add(v);
                  else s.delete(v);
                  set({ sel: s.size ? [...s] : undefined });
                }}
              />
              {ft.opt(f, v, label)}
            </label>
          ))}
          <label className="chk none">
            <input
              type="checkbox"
              checked={Array.isArray(draft.sel) && draft.sel.length === 0}
              onChange={(e) => set({ sel: e.target.checked ? [] : undefined })}
            />
            {ft.none(f)}
          </label>
        </div>
      );
    case "work":
      return (
        <>
          <fieldset className="seg">
            <legend className="sr-only">{t("workSituation")}</legend>
            {(
              [
                ["employed", t("employed")],
                ["self", t("self")],
                ["none", t("none")],
                ["sick", t("sick")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={draft.status === v}
                onClick={() => set({ status: v })}
              >
                {label}
              </button>
            ))}
          </fieldset>
          {draft.status === "employed" && (
            <Stepper
              id={`${idp}-hours`}
              label={t("hoursWeek")}
              value={draft.hours ?? ""}
              step={1}
              onChange={(v) => set({ hours: v })}
            />
          )}
        </>
      );
    case "hours":
      return (
        <>
          <Stepper
            id={`${idp}-h`}
            label={t("hoursWeek")}
            value={draft.h ?? "0"}
            step={5}
            onChange={(v) => set({ h: v })}
          />
          <p className="hint">{t("onCall")}</p>
        </>
      );
    case "zip":
      return (
        <div className="field">
          <label htmlFor={`${idp}-zip`}>{t("zip")}</label>
          <input
            id={`${idp}-zip`}
            className="txt"
            style={{ maxWidth: "9ch" }}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={draft.pc ?? ""}
            onChange={(e) => set({ pc: e.target.value.replace(/\D/g, "") })}
          />
        </div>
      );
    case "count":
      return (
        <Stepper
          id={`${idp}-n`}
          label={t("people")}
          value={draft.h ?? "1"}
          step={1}
          onChange={(v) => set({ h: v })}
        />
      );
    case "yesno":
      return (
        <div className="yn">
          <button type="button" onClick={() => submit("yes")}>
            {t("yes")}
          </button>
          <button type="button" onClick={() => submit("no")}>
            {t("no")}
          </button>
        </div>
      );
    case "choice":
      return (
        <div className="rcs">
          {fact.opts?.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="rc"
              onClick={() => submit(v as Answers[FactId])}
            >
              {ft.en ? optLabel(label, subject) : ft.opt(f, v, label)}
            </button>
          ))}
        </div>
      );
  }
}

function Stepper({
  id,
  label,
  value,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  step: number;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("q");
  const bump = (by: number) =>
    onChange(String(Math.max(0, Math.min(168, (Number(value) || 0) + by))));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          onClick={() => bump(-step)}
          aria-label={t("fewer", { n: step })}
        >
          <Icon name="minus" />
        </button>
        <input
          id={id}
          className="txt"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        />
        <button
          type="button"
          onClick={() => bump(step)}
          aria-label={t("more", { n: step })}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
