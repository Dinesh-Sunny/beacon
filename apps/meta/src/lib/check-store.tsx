"use client";

// One store for the check: answers live in this browser only (memory + localStorage), never on a server.
// Every change goes through apply(), which also writes the agent log, so the canvas can show
// exactly what each agent did and why.

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Answers, FACTS, type FactId, formatAnswer, UNSURE } from "@/engine/facts";
import {
  byId,
  derive,
  derivedChips,
  evaluate,
  plan,
  SCHEMES,
  type States,
  type Status,
} from "@/engine/rules";

export type Source = "form" | "chat" | "voice" | "letter" | "example";
export type LogKind = "you" | "derive" | "rules" | "planner" | "model";
export interface LogItem {
  id: number;
  kind: LogKind;
  who: string;
  text: string;
}

const SOURCE_WHO: Record<Source, string> = {
  form: "You",
  chat: "You, in chat",
  voice: "You, by voice",
  letter: "Letter reader",
  example: "Example",
};

const KEY = "beacon:answers:v1";

function load(): Answers {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}
function save(a: Answers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* private mode: memory only */
  }
}

export const STATUS_TXT: Record<Status, string> = {
  open: "Still open",
  likely: "Likely",
  check: "Worth checking",
  unlock: "Unlocks next",
  out: "Ruled out",
};

interface Ctx {
  answers: Answers;
  states: States;
  next: ReturnType<typeof plan>;
  log: LogItem[];
  changed: string[];
  selected: string | null;
  asked: number;
  hydrated: boolean;
  select: (id: string | null) => void;
  apply: (patch: Answers, source: Source) => void;
  back: () => void;
  reset: () => void;
  note: (kind: LogKind, who: string, text: string) => void;
  busy: Record<string, boolean>;
  setBusy: (agent: string, on: boolean) => void;
}

const CheckCtx = createContext<Ctx | null>(null);

export function CheckProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [hist, setHist] = useState<{ keys: FactId[]; prevLog: number }[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [changed, setChanged] = useState<string[]>([]);
  const [selected, select] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusyMap] = useState<Record<string, boolean>>({});
  const setBusy = useCallback((agent: string, on: boolean) => setBusyMap((b) => ({ ...b, [agent]: on })), []);
  const seq = useRef(0);

  useEffect(() => {
    const a = load();
    setAnswers(a);
    setHydrated(true);
  }, []);

  const states = useMemo(() => evaluate(answers), [answers]);
  const next = useMemo(() => plan(answers, states), [answers, states]);

  const note = useCallback((kind: LogKind, who: string, text: string) => {
    seq.current += 1;
    const item = { id: seq.current, kind, who, text };
    logRef.current = [...logRef.current, item];
    setLog(logRef.current);
  }, []);

  const ansRef = useRef<Answers>({});
  const logRef = useRef<LogItem[]>([]);
  ansRef.current = answers;
  logRef.current = log;

  const apply = useCallback((patch: Answers, source: Source) => {
    const keys = (Object.keys(patch) as FactId[]).filter((k) => patch[k] !== undefined);
    if (!keys.length) return;
    const prev = ansRef.current;
    const before = evaluate(prev);
    const after: Answers = { ...prev, ...patch };
    const st = evaluate(after);
    const d = derive(after);
    const items: Omit<LogItem, "id">[] = [];
    items.push({
      kind: "you",
      who: SOURCE_WHO[source],
      text: keys.map((k) => `${FACTS[k].label}: ${formatAnswer(k, after[k])}`).join(" · "),
    });
    const chips = keys.flatMap((k) => (after[k] === UNSURE ? [] : derivedChips(k, d)));
    if (chips.length) items.push({ kind: "derive", who: "Fact deriver", text: chips.join(" · ") });
    const moved = SCHEMES.filter((s) => before[s.id]?.status !== st[s.id]?.status);
    const group = (k: Status) => moved.filter((s) => st[s.id]?.status === k).map((s) => s.name);
    const lik = group("likely");
    const chk = group("check");
    const unl = group("unlock");
    const out = group("out");
    if (lik.length) items.push({ kind: "rules", who: "Rules engine", text: `Likely: ${lik.join(", ")}` });
    if (chk.length) items.push({ kind: "rules", who: "Rules engine", text: `Worth checking: ${chk.join(", ")}` });
    if (unl.length) items.push({ kind: "rules", who: "Chain finder", text: `${unl.join(", ")} unlock once a first claim is awarded` });
    if (out.length) items.push({ kind: "rules", who: "Rules engine", text: `Set aside ${out.length}: ${out.join(", ")}` });
    if (!moved.length) items.push({ kind: "rules", who: "Rules engine", text: "Narrowed the open rules" });
    const nx = plan(after, st);
    items.push({
      kind: "planner",
      who: "Question planner",
      text: nx ? `Next: "${FACTS[nx.f].label}" checks ${nx.hits.length} more` : "All set: nothing left that could change a result",
    });
    const stamped = items.map((it) => {
      seq.current += 1;
      return { ...it, id: seq.current };
    });
    const prevLog = logRef.current.length;
    ansRef.current = after;
    logRef.current = [...logRef.current, ...stamped];
    setAnswers(after);
    setChanged(moved.map((s) => s.id));
    setHist((h) => [...h, { keys, prevLog }]);
    setLog(logRef.current);
    save(after);
  }, []);

  const back = useCallback(() => {
    const last = hist.at(-1);
    if (!last) return;
    const copy = { ...ansRef.current };
    for (const k of last.keys) delete copy[k];
    ansRef.current = copy;
    logRef.current = logRef.current.slice(0, last.prevLog);
    setAnswers(copy);
    setLog(logRef.current);
    setChanged([]);
    setHist((h) => h.slice(0, -1));
    save(copy);
  }, [hist]);

  const reset = useCallback(() => {
    ansRef.current = {};
    logRef.current = [];
    setAnswers({});
    setHist([]);
    setLog([]);
    setChanged([]);
    select(null);
    save({});
  }, []);

  const asked = Object.keys(answers).length;
  const value: Ctx = { answers, states, next, log, changed, selected, asked, hydrated, select, apply, back, reset, note, busy, setBusy };
  return <CheckCtx.Provider value={value}>{children}</CheckCtx.Provider>;
}

export function useCheck(): Ctx {
  const c = useContext(CheckCtx);
  if (!c) throw new Error("useCheck needs CheckProvider");
  return c;
}

export const schemeName = (id: string) => byId[id]?.name ?? id;
