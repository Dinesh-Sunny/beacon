"use client";

// The question card: each fact type draws its own input, and the facts code works out from the
// answer appear underneath as you type, so the person sees why the question matters.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { type Answers, ask, FACTS, type FactId, type Money, optLabel, type Period, theyify, UNSURE, type Work, type WorkStatus } from "@/engine/facts";
import { derive, derivedChips, POSTCODE_RE, SCHEMES } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

interface Draft {
  pc?: string;
  d?: string;
  m?: string;
  y?: string;
  amt?: string;
  per?: Period;
  sel?: string[];
  status?: WorkStatus;
  hours?: string;
  h?: string;
}

type Read = { v: Answers[FactId] } | { err: string } | { empty: true };

function readDraft(f: FactId, x: Draft, today = new Date()): Read {
  const t = FACTS[f].type;
  if (t === "postcode") {
    const v = (x.pc ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    if (!v) return { empty: true };
    if (!POSTCODE_RE.test(v)) return { err: "Try the full postcode, like HA9 0WS" };
    return { v };
  }
  if (t === "date" || t === "childDate") {
    if (!x.d && !x.m && !x.y) return { empty: true };
    const dd = Number(x.d);
    const mm = Number(x.m);
    const yy = Number(x.y);
    const dt = new Date(yy, mm - 1, dd);
    if (!dd || !mm || !yy || dt.getDate() !== dd || dt.getMonth() !== mm - 1 || yy < 1900)
      return { err: "Try a real date, like 12 3 1948" };
    if (dt > today) return { err: "That date is still to come. Try a past one." };
    return { v: `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` };
  }
  if (t === "money" || t === "moneyPeriod") {
    const raw = String(x.amt ?? "").replace(/[£,\s]/g, "");
    if (!raw) return { empty: true };
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n) || n < 0) return { err: "Try an amount in pounds, like 4000" };
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
      if (!(h > 0)) return { err: "How many hours a week, roughly?" };
      return { v: { status: "employed", hours: h } };
    }
    return { v: { status: x.status } };
  }
  if (t === "hours") {
    const n = Number(x.h ?? 0);
    if (Number.isNaN(n) || n < 0 || n > 168) return { err: "Try a number of hours between 0 and 168" };
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
  onAnswer?: (f: FactId, v: Answers[FactId]) => void;
  inChat?: boolean;
}) {
  const { answers, apply, states, edit, skip, skipped, subject } = useCheck();
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
    else body.current?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
  }, [f]);

  const fact = FACTS[f];
  const hits = SCHEMES.filter((s) => states[s.id]?.status === "open" && states[s.id]?.unknown.includes(f));
  const set = (patch: Draft) => {
    setErr("");
    setDraft((d) => ({ ...d, ...patch }));
  };
  const r = readDraft(f, draft);
  const preview = "v" in r ? derivedChips(f, derive({ ...answers, [f]: r.v })) : [];
  const save = (v: Answers[FactId]) => (onAnswer ? onAnswer(f, v) : apply({ [f]: v }, "form"));
  const submit = (value?: Answers[FactId]) => {
    if (value !== undefined) return save(value);
    if ("err" in r) return setErr(r.err);
    if ("empty" in r) return setErr(emptyHint(fact.type));
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
    <section className={`qcard${inChat ? " in-chat" : ""}`} aria-labelledby={inChat ? "q-chat" : "q-title"} data-testid={inChat ? "chat-question" : "question"} data-fact={f}>
      <div className="qtop">
        {editing ? <span className="eyebrow">{answers[f] === undefined ? "Answer here" : "Change an answer"}</span> : <span />}
        {hits.length > 0 && (
          <span className="unlocks" data-testid="unlocks">
            <Icon name="search" size={14} /> Checks {hits.length} {hits.length === 1 ? "scheme" : "schemes"}
          </span>
        )}
      </div>
      <h2 id={inChat ? "q-chat" : "q-title"}>{ask(f, subject)}</h2>
      <p className="why">{theyify(fact.why, subject)}</p>

      <div ref={body} onKeyDown={onKey} className="qbody">
        <Input f={f} idp={inChat ? "c" : "d"} draft={draft} set={set} submit={submit} />
      </div>

      {!instant && (
        <div className="derived" aria-live="polite">
          {preview.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <button type="button" className="linkbtn unsure" onClick={() => submit(UNSURE)} data-testid="unsure">
        I'm not sure
      </button>
      <div className="qactions">
        {!instant && (
          <button type="button" className="btn" onClick={() => submit()} data-testid="continue">
            Save and continue
          </button>
        )}
        {editing ? (
          <button type="button" className="btn ghost" onClick={() => edit(null)}>
            Cancel
          </button>
        ) : canSkip ? (
          <button type="button" className="btn ghost" onClick={() => skip(f)} data-testid="skip">
            Skip for now
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
  if (t === "postcode") return { pc: String(v) };
  if ((t === "date" || t === "childDate") && typeof v === "string" && v !== "none") {
    const [y, m, d] = v.split("-");
    return { y, m: String(Number(m)), d: String(Number(d)) };
  }
  if (t === "money") return { amt: String(v) };
  if (t === "moneyPeriod") return { amt: String((v as Money).amt), per: (v as Money).per };
  if (t === "checklist") return { sel: v as string[] };
  if (t === "work") return { status: (v as Work).status, hours: (v as Work).hours ? String((v as Work).hours) : undefined };
  if (t === "hours") return { h: String(v) };
  return {};
}

function emptyHint(t: string): string {
  if (t === "checklist") return "Tick any that fit, or 'None of these'";
  if (t === "work") return "Pick the one that fits best";
  return "Add an answer, or choose 'I'm not sure'";
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
  const { subject } = useCheck();
  const fact = FACTS[f];
  switch (fact.type) {
    case "postcode":
      return (
        <div className="field">
          <label htmlFor={`${idp}-pc`}>Postcode</label>
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
            <button type="button" className="rc" onClick={() => submit("none")} data-testid="no-children">
              No children
            </button>
          )}
          <p className="hint">{fact.type === "childDate" ? "Or their date of birth" : "For example, 12 3 1948"}</p>
          <div className="dates">
            {(
              [
                ["d", "Day", 2],
                ["m", "Month", 2],
                ["y", "Year", 4],
              ] as const
            ).map(([k, label, len]) => (
              <div key={k} className={`field${k === "y" ? " y" : ""}`}>
                <label htmlFor={`${idp}-${k}`}>{label}</label>
                <input
                  id={`${idp}-${k}`}
                  className="txt"
                  inputMode="numeric"
                  maxLength={len}
                  value={draft[k] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    set({ [k]: v });
                    if (v.length === len && k !== "y")
                      document.getElementById(`${idp}-${k === "d" ? "m" : "y"}`)?.focus();
                  }}
                />
              </div>
            ))}
          </div>
        </>
      );
    case "money":
    case "moneyPeriod":
      return (
        <>
          <div className="field">
            <label htmlFor={`${idp}-amt`}>{fact.type === "moneyPeriod" ? "Amount after tax" : "Amount"}</label>
            <div className="money">
              <span>£</span>
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
            <div className="seg" role="group" aria-label="How often">
              {(["week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={(draft.per ?? "week") === p}
                  onClick={() => set({ per: p })}
                >
                  a {p}
                </button>
              ))}
            </div>
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
              {label}
            </label>
          ))}
          <label className="chk none">
            <input
              type="checkbox"
              checked={Array.isArray(draft.sel) && draft.sel.length === 0}
              onChange={(e) => set({ sel: e.target.checked ? [] : undefined })}
            />
            {fact.none}
          </label>
        </div>
      );
    case "work":
      return (
        <>
          <div className="seg" role="group" aria-label="Work situation">
            {(
              [
                ["employed", "Employed"],
                ["self", "Self-employed"],
                ["none", "Not working"],
                ["sick", "Off sick"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={draft.status === v} onClick={() => set({ status: v })}>
                {label}
              </button>
            ))}
          </div>
          {draft.status === "employed" && (
            <Stepper id={`${idp}-hours`} label="Hours a week" value={draft.hours ?? ""} step={1} onChange={(v) => set({ hours: v })} />
          )}
        </>
      );
    case "hours":
      return (
        <>
          <Stepper id={`${idp}-h`} label="Hours a week" value={draft.h ?? "0"} step={5} onChange={(v) => set({ h: v })} />
          <p className="hint">Count time on call too.</p>
        </>
      );
    case "yesno":
      return (
        <div className="yn">
          <button type="button" onClick={() => submit("yes")}>
            Yes
          </button>
          <button type="button" onClick={() => submit("no")}>
            No
          </button>
        </div>
      );
    case "choice":
      return (
        <div className="rcs">
          {fact.opts?.map(([v, label]) => (
            <button key={v} type="button" className="rc" onClick={() => submit(v as Answers[FactId])}>
              {optLabel(label, subject)}
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
  const bump = (by: number) => onChange(String(Math.max(0, Math.min(168, (Number(value) || 0) + by))));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" onClick={() => bump(-step)} aria-label={`${step} fewer`}>
          <Icon name="minus" />
        </button>
        <input
          id={id}
          className="txt"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        />
        <button type="button" onClick={() => bump(step)} aria-label={`${step} more`}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
