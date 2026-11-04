"use client";

// Details: everything Beacon knows, and every question it can ask, in one list grouped by topic.
// Each row is either answered (value, where it came from, change or forget) or still open
// (the question, and Answer). Answering here opens the same question card as the chat.

import { useEffect, useState } from "react";
import { QuestionCard } from "@/components/check/QuestionCard";
import { Icon } from "@/components/Icon";
import {
  type Answers,
  ask,
  FACTS,
  type FactId,
  ORDER,
  showAnswer,
} from "@/engine/facts";
import { count, SCHEMES } from "@/engine/rules";
import { type Source, useCheck } from "@/lib/check-store";
import { useCouncil } from "@/lib/council";

const GROUPS: { title: string; icon: string; facts: FactId[] }[] = [
  {
    title: "Where they live",
    icon: "pin",
    facts: ["postcode", "housing", "household", "ctax"],
  },
  { title: "About them", icon: "person", facts: ["dob", "difficulties"] },
  {
    title: "Money",
    icon: "spark",
    facts: ["income", "savings", "benefits", "debt"],
  },
  { title: "Work", icon: "doc", facts: ["work", "ni"] },
  {
    title: "Family and caring",
    icon: "shield",
    facts: ["child", "pregnant", "careHours", "bereaved"],
  },
];

const FROM: Record<Source, string> = {
  form: "You answered",
  chat: "From the chat",
  voice: "From what you said",
  letter: "Read from a letter",
  example: "From the example",
};

const PEOPLE = [
  "Mum",
  "Dad",
  "My partner",
  "My son",
  "My daughter",
  "A friend",
];

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
  const settled = SCHEMES.length - count(states, "open");
  const groupTitle = (t: string) =>
    subject.who === "me"
      ? t.replace("they live", "you live").replace("them", "you")
      : t;

  return (
    <div className="details" data-testid="details">
      <div className="details-head">
        <h2>Details</h2>
        <button
          type="button"
          className="iconbtn"
          onClick={onClose}
          aria-label="Close details"
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
                  ? "Checking for you"
                  : `Checking for ${subject.label}`}
              </b>
              <button
                type="button"
                className="linkbtn"
                onClick={() => setPicking((p) => !p)}
                aria-expanded={picking}
              >
                Change
              </button>
            </div>
            {picking && <WhoPicker onDone={() => setPicking(false)} />}
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${(settled / SCHEMES.length) * 100}%` }} />
            </div>
            <span className="hint">
              {settled} of {SCHEMES.length} checked · {saved}{" "}
              {saved === 1 ? "detail" : "details"} saved on this device
            </span>
          </div>
        </div>

        {editing && <QuestionCard key={editing} f={editing} />}

        {undo && (
          <div className="toast" role="status">
            Forgotten.
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                apply({ [undo.f]: undo.v }, "form");
                setUndo(null);
              }}
            >
              Undo
            </button>
          </div>
        )}

        {GROUPS.map((g) => {
          const facts = g.facts.filter((f) => f !== editing);
          if (!facts.length) return null;
          const done = facts.filter((f) => answers[f] !== undefined).length;
          return (
            <section key={g.title} className="group">
              <div className="group-head">
                <Icon name={g.icon} size={16} />
                <b>{groupTitle(g.title)}</b>
                <span className="hint">
                  {done} of {facts.length}
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
                        {has ? FACTS[f].label : ask(f, subject)}
                      </span>
                      {has ? (
                        <>
                          <b>
                            {showAnswer(answers, f)}
                            {f === "postcode" && council
                              ? ` · ${council.name}`
                              : ""}
                          </b>
                          <span className="src">
                            {src ? FROM[src.source] : "Saved on this device"}
                          </span>
                        </>
                      ) : opens ? (
                        <span className="opens">
                          Checks {opens} {opens === 1 ? "scheme" : "schemes"}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => edit(f)}
                      aria-label={`${has ? "Change" : "Answer"} ${FACTS[f].label}`}
                    >
                      {has ? "Change" : "Answer"}
                    </button>
                    {has && (
                      <button
                        type="button"
                        className="iconbtn sm row-forget"
                        onClick={() => {
                          setUndo({ f, v: answers[f] });
                          forget(f);
                        }}
                        aria-label={`Forget ${FACTS[f].label}`}
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
  const [other, setOther] = useState("");
  const pick = (label?: string) => {
    setSubject(label ? { who: "other", label } : { who: "me" });
    onDone();
  };
  return (
    <div className="who-picker" data-testid="who-picker">
      <span className="hint">Who is this check for?</span>
      <div className="who-chips">
        <button
          type="button"
          aria-pressed={subject.who === "me"}
          onClick={() => pick()}
        >
          Me
        </button>
        {PEOPLE.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={subject.label === p}
            onClick={() => pick(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <form
        className="who-other"
        onSubmit={(e) => {
          e.preventDefault();
          if (other.trim()) pick(other.trim().slice(0, 20));
        }}
      >
        <label htmlFor="who-other" className="sr-only">
          Someone else
        </label>
        <input
          id="who-other"
          className="txt"
          placeholder="Someone else, like Nan"
          value={other}
          maxLength={20}
          onChange={(e) => setOther(e.target.value)}
        />
        <button type="submit" className="btn small" disabled={!other.trim()}>
          Use
        </button>
      </form>
    </div>
  );
}
