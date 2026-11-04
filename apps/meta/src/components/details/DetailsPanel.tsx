"use client";

// Details: everything Beacon knows, and every question it can ask, in one list grouped by topic.
// Each row is either answered (value, where it came from, change or forget) or still open
// (the question, and Answer). Answering here opens the same question card as the chat.

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { QuestionCard } from "@/components/check/QuestionCard";
import { Icon } from "@/components/Icon";
import { type Answers, type FactId, ORDER } from "@/engine/facts";
import { count, inPlay, SCHEMES } from "@/engine/rules";
import { useFactText } from "@/i18n/useFactText";
import { type Source, useCheck } from "@/lib/check-store";
import { useCouncil } from "@/lib/council";

/** Title keys: [for me, for someone else]. */
const GROUPS = [
  {
    title: ["whereMe", "whereThey"],
    icon: "pin",
    facts: ["postcode", "housing", "household", "ctax"],
  },
  {
    title: ["aboutMe", "aboutThey"],
    icon: "person",
    facts: ["dob", "difficulties"],
  },
  {
    title: ["money", "money"],
    icon: "spark",
    facts: ["income", "savings", "benefits", "debt"],
  },
  { title: ["work", "work"], icon: "doc", facts: ["work", "ni"] },
  {
    title: ["family", "family"],
    icon: "shield",
    facts: ["child", "pregnant", "careHours", "bereaved"],
  },
] as const satisfies {
  title: readonly [string, string];
  icon: string;
  facts: readonly FactId[];
}[];

const PEOPLE = ["mum", "dad", "partner", "son", "daughter", "friend"] as const;
type From = Source;

export function DetailsPanel({ onClose }: { onClose: () => void }) {
  const {
    answers,
    states,
    edit,
    subject,
    editing,
    sources,
    forget,
    apply,
    resets,
  } = useCheck();
  const t = useTranslations("details");
  const ft = useFactText();
  const [picking, setPicking] = useState(false);
  const council = useCouncil(answers.postcode);
  const [undo, setUndo] = useState<{ f: FactId; v: Answers[FactId] } | null>(
    null,
  );
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear on start again
  useEffect(() => {
    setUndo(null);
    setPicking(false);
  }, [resets]);
  const saved = ORDER.filter((f) => answers[f] !== undefined).length;
  const total = inPlay(states).length;
  const settled = total - count(states, "open");
  const groupTitle = (k: readonly [string, string]) =>
    t((subject.who === "me" ? k[0] : k[1]) as "money");

  return (
    <div className="details" data-testid="details">
      <div className="details-head">
        <h2>{t("title")}</h2>
        <button
          type="button"
          className="iconbtn"
          onClick={onClose}
          aria-label={t("close")}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="details-body">
        <div className="who-card">
          <span className="avatar" aria-hidden="true">
            {subject.who === "me" ? (
              <Icon name="person" size={18} />
            ) : (
              (subject.label ?? "?").slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <div className="who-line">
              <b data-testid="who">
                {subject.who === "me"
                  ? t("checkingMe")
                  : t("checkingThey", { name: subject.label ?? "" })}
              </b>
              <button
                type="button"
                className="linkbtn"
                onClick={() => setPicking((p) => !p)}
                aria-expanded={picking}
              >
                {t("change")}
              </button>
            </div>
            {picking && <WhoPicker onDone={() => setPicking(false)} />}
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${(settled / total) * 100}%` }} />
            </div>
            <span className="hint">
              {t("progress", {
                done: settled,
                total,
                count: saved,
              })}
            </span>
          </div>
        </div>

        {editing && <QuestionCard key={editing} f={editing} />}

        {undo && (
          <div className="toast" role="status">
            {t("forgotten")}
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                apply({ [undo.f]: undo.v }, "form");
                setUndo(null);
              }}
            >
              {t("undo")}
            </button>
          </div>
        )}

        {GROUPS.map((g) => {
          const facts = (g.facts as readonly FactId[]).filter(
            (f) => f !== editing,
          );
          if (!facts.length) return null;
          const done = facts.filter((f) => answers[f] !== undefined).length;
          return (
            <section key={g.title[0]} className="group">
              <div className="group-head">
                <Icon name={g.icon} size={16} />
                <b>{groupTitle(g.title)}</b>
                <span className="hint">
                  {t("groupCount", { done, total: facts.length })}
                </span>
              </div>
              {facts.map((f) => {
                const has = answers[f] !== undefined;
                const opens = SCHEMES.filter(
                  (s) =>
                    states[s.id]?.status === "open" &&
                    states[s.id]?.unknown.includes(f),
                ).length;
                const src = sources[f];
                return (
                  <div
                    key={f}
                    className={`detail-row${has ? "" : " todo"}`}
                    data-testid={`detail-${f}`}
                  >
                    <div>
                      <span className="hint">
                        {has ? ft.label(f) : ft.ask(f, subject)}
                      </span>
                      {has ? (
                        <>
                          <b>
                            {ft.show(answers, f)}
                            {f === "postcode" && council
                              ? ` · ${council.name}`
                              : ""}
                          </b>
                          <span className="src">
                            {src
                              ? t(`from.${src.source as From}`)
                              : t("savedHere")}
                          </span>
                        </>
                      ) : opens ? (
                        <span className="opens">
                          {t("checksN", { count: opens })}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => edit(f)}
                      aria-label={t(has ? "changeLabel" : "answerLabel", {
                        label: ft.label(f),
                      })}
                    >
                      {has ? t("change") : t("answer")}
                    </button>
                    {has && (
                      <button
                        type="button"
                        className="iconbtn sm row-forget"
                        onClick={() => {
                          setUndo({ f, v: answers[f] });
                          forget(f);
                        }}
                        aria-label={t("forget", { label: ft.label(f) })}
                        data-testid={`forget-${f}`}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WhoPicker({ onDone }: { onDone: () => void }) {
  const { subject, setSubject } = useCheck();
  const t = useTranslations("details");
  const [other, setOther] = useState("");
  const pick = (label?: string) => {
    setSubject(label ? { who: "other", label } : { who: "me" });
    onDone();
  };
  return (
    <div className="who-picker" data-testid="who-picker">
      <span className="hint">{t("whoFor")}</span>
      <div className="who-chips">
        <button
          type="button"
          aria-pressed={subject.who === "me"}
          onClick={() => pick()}
        >
          {t("me")}
        </button>
        {PEOPLE.map((k) => {
          const p = t(`people.${k}`);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={subject.label === p}
              onClick={() => pick(p)}
            >
              {p}
            </button>
          );
        })}
      </div>
      <form
        className="who-other"
        onSubmit={(e) => {
          e.preventDefault();
          if (other.trim()) pick(other.trim().slice(0, 20));
        }}
      >
        <label htmlFor="who-other" className="sr-only">
          {t("someoneElse")}
        </label>
        <input
          id="who-other"
          className="txt"
          placeholder={t("someoneElseHint")}
          value={other}
          maxLength={20}
          onChange={(e) => setOther(e.target.value)}
        />
        <button type="submit" className="btn small" disabled={!other.trim()}>
          {t("use")}
        </button>
      </form>
    </div>
  );
}
