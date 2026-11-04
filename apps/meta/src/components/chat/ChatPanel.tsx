"use client";

// The agent chat (Lovart left panel). People can type, speak or add a letter. Muse Spark reads
// it, saves the facts through tools, and the form, board and Details update straight away.

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Logo } from "@/components/Icon";
import type { Answers } from "@/engine/facts";
import { FACTS, type FactId, formatAnswer } from "@/engine/facts";
import { useCheck } from "@/lib/check-store";
import { Composer } from "./Composer";

export interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
  notes?: string[];
  saved?: Answers;
  image?: string;
  agent?: string;
  error?: boolean;
}

const STARTERS = [
  "My mum is 78, lives alone in Wembley and gets her State Pension",
  "I care for my brother about 50 hours a week",
  "We've just had a baby and I work part time",
];

const ERRORS: Record<string, string> = {
  offline: "My reading tools are resting right now. The questions on the right still work, and every answer counts.",
  busy: "Lots of people are checking at once. Give it a minute and try again.",
  slow: "That took longer than usual. Try once more, or carry on with the questions on the right.",
  model: "I couldn't finish that one. Try saying it a different way, or use the questions on the right.",
};
export const errorText = (code?: string) => ERRORS[code ?? "model"] ?? ERRORS.model;

let seq = 0;
const nextId = () => {
  seq += 1;
  return seq;
};

export function ChatPanel() {
  const { answers, apply, note, setBusy } = useCheck();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.length, working]);

  const push = useCallback((m: Omit<Msg, "id">) => setMsgs((list) => [...list, { ...m, id: nextId() }]), []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const mine: Msg = { id: nextId(), role: "user", text: clean };
      let history: { role: "user" | "assistant"; content: string }[] = [];
      setMsgs((list) => {
        history = [...list, mine]
          .filter((m) => !m.error)
          .slice(-12)
          .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
        return [...list, mine];
      });
      setWorking("Reading what you said");
      setBusy("Muse Spark agent", true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, answers: answersRef.current }),
        });
        const data = (await res.json()) as { reply?: string; saved?: Answers; notes?: { name: string; text: string }[]; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "model");
        const saved = data.saved ?? {};
        if (Object.keys(saved).length) apply(saved, "chat");
        for (const n of data.notes ?? []) note("model", "Muse Spark agent", n.text);
        push({
          role: "bot",
          text: data.reply || "Saved. Have a look at the next question on the right.",
          notes: (data.notes ?? []).filter((n) => n.name === "save_details").map((n) => n.text),
          saved,
          agent: "Muse Spark",
        });
      } catch (e) {
        push({ role: "bot", text: errorText((e as Error).message), error: true });
      } finally {
        setWorking(null);
        setBusy("Muse Spark agent", false);
      }
    },
    [apply, note, push, setBusy],
  );

  // A first message typed on the home page arrives here once.
  useEffect(() => {
    try {
      const first = sessionStorage.getItem("beacon:first");
      if (first) {
        sessionStorage.removeItem("beacon:first");
        void send(first);
      }
    } catch {
      /* storage blocked */
    }
  }, [send]);

  return (
    <>
      <div className="thread" data-testid="thread">
        <div className="msg bot welcome">
          <Logo size={30} />
          <p className="bubble plain">
            Hi, I'm Beacon. Tell me a little about your life, or the life of someone you look after, and I'll find the support
            that's already yours.
          </p>
          <p className="hint">Type, speak, or add a photo of a letter. It all stays on this device.</p>
        </div>
        {msgs.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {working && (
          <div className="working" role="status">
            <Logo size={16} /> {working}
            <span className="typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      {msgs.length === 0 && !working && (
        <div className="suggest" aria-label="Try saying">
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <Composer onSend={send} busy={Boolean(working)} push={push} setWorking={setWorking} />
    </>
  );
}

function Message({ m }: { m: Msg }) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const savedKeys = Object.keys(m.saved ?? {}) as FactId[];
  if (m.role === "user")
    return (
      <div className="msg me">
        {m.image && <img className="thumb" src={m.image} alt="Your letter" />}
        <div className="bubble">{m.text}</div>
      </div>
    );
  return (
    <div className={`msg bot${m.error ? " soft" : ""}`}>
      {m.notes?.map((n) => (
        <div key={n} className="status-pill">
          <Icon name="check" size={16} /> {n}
        </div>
      ))}
      {savedKeys.length > 0 && (
        <div className="facts">
          {savedKeys.map((k) => (
            <span key={k} className="fact-chip">
              {FACTS[k].label}: {formatAnswer(k, m.saved?.[k])}
            </span>
          ))}
        </div>
      )}
      <p className="bubble plain">{m.text}</p>
      {!m.error && (
        <div className="msg-actions">
          <button type="button" className="iconbtn sm" aria-label="Helpful" aria-pressed={rated === "up"} onClick={() => setRated("up")}>
            <Icon name="thumbup" size={16} />
          </button>
          <button type="button" className="iconbtn sm" aria-label="Not helpful" aria-pressed={rated === "down"} onClick={() => setRated("down")}>
            <Icon name="thumbdown" size={16} />
          </button>
          <button
            type="button"
            className="iconbtn sm"
            aria-label={copied ? "Copied" : "Copy"}
            onClick={() => {
              void navigator.clipboard?.writeText(m.text).then(() => setCopied(true));
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
          </button>
          {rated && <span className="hint">Thanks, that helps.</span>}
        </div>
      )}
    </div>
  );
}
