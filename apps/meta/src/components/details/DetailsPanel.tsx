"use client";

// Details: what Beacon knows, and the progressive form that fills it in. "Fill in" asks one
// question at a time; "See details" lists every saved answer with where it came from, so the
// person can change or forget any of it.

import { useState } from "react";
import { QuestionCard } from "@/components/check/QuestionCard";
import { Icon } from "@/components/Icon";
import { type Answers, ask, FACTS, type FactId, ORDER, showAnswer } from "@/engine/facts";
import { byId, count, SCHEMES } from "@/engine/rules";
import { type Source, useCheck } from "@/lib/check-store";

const GROUPS: { title: string; icon: string; facts: FactId[] }[] = [
  { title: "Where you live", icon: "pin", facts: ["postcode", "ctax"] },
  { title: "About you", icon: "person", facts: ["dob", "difficulties"] },
  { title: "Money", icon: "spark", facts: ["income", "savings", "benefits"] },
  { title: "Work", icon: "doc", facts: ["work", "ni"] },
  { title: "Family and caring", icon: "shield", facts: ["child", "pregnant", "careHours", "bereaved"] },
];

const FROM: Record<Source, string> = {
  form: "You filled this in",
  chat: "From the chat",
  voice: "From what you said",
  letter: "Read from your letter",
  example: "From the example",
};

export function DetailsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"fill" | "see">("fill");
  const { answers, states, current, edit, subject, editing } = useCheck();
  const [picking, setPicking] = useState(false);
  const saved = ORDER.filter((f) => answers[f] !== undefined).length;
  const open = count(states, "open");
  const change = (f: FactId) => {
    edit(f);
    setTab("fill");
  };
  return (
    <div className="details" data-testid="details">
      <div className="details-head">
        <h2>Details</h2>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close details">
          <Icon name="close" />
        </button>
      </div>
      <p className="hint">What Beacon knows so far. It stays on this device.</p>
      <div className="tabs" role="tablist" aria-label="Details">
        <button type="button" role="tab" aria-selected={tab === "see"} onClick={() => setTab("see")} data-testid="tab-see">
          See details
        </button>
        <button type="button" role="tab" aria-selected={tab === "fill"} onClick={() => setTab("fill")} data-testid="tab-fill">
          All questions
        </button>
      </div>
      <div className="details-body">
        <div className="who-card">
          <span className="avatar" aria-hidden="true">
            {subject.who === "me" ? <Icon name="person" size={18} /> : (subject.label ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="who-line">
              <b data-testid="who">{subject.who === "me" ? "Checking for you" : `Checking for ${subject.label}`}</b>
              <button type="button" className="linkbtn" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                Change
              </button>
            </div>
            {picking && <WhoPicker onDone={() => setPicking(false)} />}
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${((SCHEMES.length - open) / SCHEMES.length) * 100}%` }} />
            </div>
            <span className="hint">
              {saved} {saved === 1 ? "detail" : "details"} saved.{" "}
              {open ? `${open} schemes still need an answer.` : "Every scheme is checked."}
            </span>
          </div>
        </div>
        {tab === "fill" ? (
          <>
            {editing ? <QuestionCard key={editing} f={editing} /> : current ? null : <AllSet />}
            <AllQuestions onPick={change} />
            <Locked />
          </>
        ) : (
          <SeeDetails onChange={change} />
        )}
      </div>
    </div>
  );
}

const PEOPLE = ["Mum", "Dad", "My partner", "My son", "My daughter", "A friend"];

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
        <button type="button" aria-pressed={subject.who === "me"} onClick={() => pick()}>
          Me
        </button>
        {PEOPLE.map((p) => (
          <button key={p} type="button" aria-pressed={subject.label === p} onClick={() => pick(p)}>
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
        <input id="who-other" className="txt" placeholder="Someone else, like Nan" value={other} maxLength={20} onChange={(e) => setOther(e.target.value)} />
        <button type="submit" className="btn small" disabled={!other.trim()}>
          Use
        </button>
      </form>
    </div>
  );
}

function AllSet() {
  const { states } = useCheck();
  return (
    <div className="allset" data-testid="allset">
      <Icon name="check" size={22} />
      <div>
        <b>All set</b>
        <p className="hint">
          Nothing else could change a result. {count(states, "likely")} likely, {count(states, "check")} worth checking.
        </p>
      </div>
    </div>
  );
}

function AllQuestions({ onPick }: { onPick: (f: FactId) => void }) {
  const { answers, editing, states, subject } = useCheck();
  return (
    <div className="answered">
      <span className="hint">Answer in the chat, or pick any question here.</span>
      {ORDER.filter((f) => f !== editing).map((f) => {
        const done = answers[f] !== undefined;
        const opens = SCHEMES.filter((s) => states[s.id]?.status === "open" && states[s.id]?.unknown.includes(f)).length;
        return (
          <div key={f} className={`ans${done ? "" : " todo"}`}>
            <Icon name={done ? "check" : "dots"} size={16} />
            <div>
              <span className="hint">{done ? FACTS[f].label : ask(f, subject)}</span>
              {done ? <b>{showAnswer(answers, f)}</b> : opens ? <span className="opens">Checks {opens} {opens === 1 ? "scheme" : "schemes"}</span> : null}
            </div>
            <button type="button" className="linkbtn" onClick={() => onPick(f)} aria-label={`${done ? "Change" : "Answer"} ${FACTS[f].label}`}>
              {done ? "Change" : "Answer"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Locked() {
  const { states } = useCheck();
  const list = SCHEMES.filter((s) => states[s.id]?.status === "unlock");
  if (!list.length) return null;
  return (
    <div className="locked">
      {list.map((s) => (
        <div key={s.id} className="lock-row">
          <Icon name="lock" size={16} />
          <div>
            <b>{s.name}</b>
            <span className="hint">{states[s.id]?.reason}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeeDetails({ onChange }: { onChange: (f: FactId) => void }) {
  const { answers, sources, forget, apply } = useCheck();
  const [undo, setUndo] = useState<{ f: FactId; v: Answers[FactId] } | null>(null);
  const any = ORDER.some((f) => answers[f] !== undefined);
  if (!any && !undo)
    return <p className="hint empty-note">Nothing saved yet. Answer a question, chat, speak or add a letter, and it shows up here.</p>;
  return (
    <div className="groups">
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
        const facts = g.facts.filter((f) => answers[f] !== undefined);
        if (!facts.length) return null;
        return (
          <section key={g.title} className="group">
            <div className="group-head">
              <Icon name={g.icon} size={16} />
              <b>{g.title}</b>
              <span className="hint">
                {facts.length} {facts.length === 1 ? "detail" : "details"}
              </span>
            </div>
            {facts.map((f) => {
              const src = sources[f];
              return (
                <div key={f} className="detail-row" data-testid={`detail-${f}`}>
                  <div>
                    <span className="hint">{FACTS[f].label}</span>
                    <b>{showAnswer(answers, f)}</b>
                    <span className="src">
                      <Icon name={src?.source === "letter" ? "doc" : src?.source === "voice" ? "mic" : "chat"} size={13} />
                      {src ? FROM[src.source] : "Saved on this device"}
                    </span>
                  </div>
                  <button type="button" className="iconbtn" onClick={() => onChange(f)} aria-label={`Change ${FACTS[f].label}`}>
                    <Icon name="pencil" size={18} />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={() => {
                      setUndo({ f, v: answers[f] });
                      forget(f);
                    }}
                    aria-label={`Forget ${FACTS[f].label}`}
                    data-testid={`forget-${f}`}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export const schemeLabel = (id: string) => byId[id]?.name ?? id;
