"use client";

// The agent chat (Lovart left panel). People can type, speak or add a letter. Muse Spark reads
// it, saves the facts through tools, and the form, board and Details update straight away.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { QuestionCard } from "@/components/check/QuestionCard";
import { Icon, Logo } from "@/components/Icon";
import { isFactId } from "@/engine/answers-schema";
import {
  type Answers,
  ask,
  callerPhrase,
  FACTS,
  type FactId,
  formatAnswer,
  LIFE_EVENTS,
  ORDER,
  showAnswer,
} from "@/engine/facts";
import { evaluate, SCHEMES } from "@/engine/rules";
import { intlTag } from "@/i18n/locales";
import { useFactText } from "@/i18n/useFactText";
import { useCheck } from "@/lib/check-store";
import { isOn, useDisplay } from "@/lib/display";
import { shrink } from "@/lib/image";
import { speak } from "@/lib/speech";
import { Composer } from "./Composer";
import { LetterCard } from "./LetterCard";

export interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
  notes?: string[];
  saved?: Answers;
  image?: string;
  agent?: string;
  error?: boolean;
  via?: "voice";
  qa?: { q: string; a: string };
  letter?: LetterView;
}

export interface LetterView {
  image: string;
  w: number;
  h: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null;
  from: string | null;
  kind: string | null;
  summary: string | null;
  action: string | null;
  deadlines: { what: string; date: string | null }[];
}

const ERRORS = {
  offline: "errOffline",
  busy: "errBusy",
  slow: "errSlow",
  model: "errModel",
} as const;
/** The message id for an error code from the server. */
const errorKey = (code?: string) =>
  ERRORS[(code ?? "model") as keyof typeof ERRORS] ?? ERRORS.model;

// Random ids stay unique even when the module reloads while messages are on screen.
const nextId = () => crypto.randomUUID();

export function ChatPanel({ playing = false }: { playing?: boolean }) {
  const tc = useTranslations("chat");
  const te = useTranslations("events");
  const locale = useLocale();
  const ft = useFactText();
  const {
    answers,
    apply,
    note,
    setBusy,
    subject,
    setSubject,
    next,
    resets,
    announcement,
    asked,
    setFocus,
  } = useCheck();
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  const [msgs, setMsgsState] = useState<Msg[]>([]);
  const msgsRef = useRef<Msg[]>([]);
  const setMsgs = useCallback((next: Msg[] | ((list: Msg[]) => Msg[])) => {
    msgsRef.current = typeof next === "function" ? next(msgsRef.current) : next;
    setMsgsState(msgsRef.current);
  }, []);
  // Replies that arrive after "Start again" or a new example belong to the old check: drop them.
  const epoch = useRef(0);
  const [working, setWorking] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    // A fresh check stays at the top, so the welcome and first question read in order.
    if (!msgs.length) return;
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.length, working, next?.f]);

  // Read aloud setting: speak each new reply from Beacon, then the next question, in the
  // person's language and speed (captions follow when they're on).
  const { display } = useDisplay();
  const lastSpoken = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: speak when a new message or question arrives
  useEffect(() => {
    if (!display.on.includes("readAloud") || working) return;
    const last = msgs.at(-1);
    const lines: string[] = [];
    const key = `${last?.id ?? ""}:${next?.f ?? ""}`;
    if (key === lastSpoken.current) return;
    lastSpoken.current = key;
    if (last?.role === "bot") lines.push(...(last.notes ?? []), last.text);
    if (next) lines.push(ft.ask(next.f, subjectRef.current));
    if (lines.length) void speak(lines, intlTag(locale));
  }, [msgs.length, next?.f, working, display.on]);

  // Clear the chat when the check starts again.
  useEffect(() => {
    if (resets) {
      epoch.current += 1;
      setMsgs([]);
    }
  }, [resets, setMsgs]);

  // Show each announcement once, keyed by its id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on the id only, not the object
  useEffect(() => {
    if (announcement)
      setMsgs((list) => [
        ...list,
        { id: nextId(), role: "bot", text: announcement.text },
      ]);
  }, [announcement?.id, setMsgs]);

  const push = useCallback(
    (m: Omit<Msg, "id">) =>
      setMsgs((list) => [...list, { ...m, id: nextId() }]),
    [setMsgs],
  );

  const send = useCallback(
    async (text: string, via?: "voice") => {
      const clean = text.trim();
      if (!clean) return;
      const mine: Msg = { id: nextId(), role: "user", text: clean, via };
      const history = [...msgsRef.current, mine]
        .filter((m) => !m.error && m.text.trim())
        .slice(-12)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text.slice(0, 4000),
        }));
      setMsgs((list) => [...list, mine]);
      const myEpoch = epoch.current;
      setWorking("Reading what you said");
      setBusy("Muse Spark agent", true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({
            messages: history,
            answers: answersRef.current,
            subject: subjectRef.current,
            locale,
            simple: isOn("simple"),
          }),
        });
        type Done = {
          reply?: string;
          saved?: Answers;
          notes?: { name: string; text: string }[];
          subject?: { who: "me" | "other"; label?: string } | null;
          error?: string;
        };
        let data: Done = {};
        if (!res.ok || !res.body) {
          data = (await res.json().catch(() => ({ error: "model" }))) as Done;
        } else {
          // Each line is one step; show it as it happens so the wait feels like work, not a spinner.
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl = buf.indexOf("\n");
            while (nl >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              nl = buf.indexOf("\n");
              if (!line) continue;
              const ev = JSON.parse(line) as {
                type: string;
                text?: string;
              } & Done;
              if (ev.type === "step" && ev.text && myEpoch === epoch.current)
                setWorking(ev.text);
              if (ev.type === "done" || ev.type === "error") data = ev;
            }
          }
        }
        if (!res.ok || data.error) throw new Error(data.error ?? "model");
        if (myEpoch !== epoch.current) return;
        if (data.subject) setSubject(data.subject);
        const saved = data.saved ?? {};
        if (Object.keys(saved).length) apply(saved, "chat");
        for (const n of data.notes ?? [])
          note("model", "Muse Spark agent", n.text);
        push({
          role: "bot",
          text: data.reply || tc("fallback"),
          // The save line is worded here, in the reader's language, from what was saved.
          notes:
            (data.notes ?? []).some((n) => n.name === "save_details") &&
            Object.keys(saved).filter(isFactId).length
              ? [
                  tc("savedN", {
                    count: Object.keys(saved).filter(isFactId).length,
                    progress: ft.progress(
                      evaluate({ ...answersRef.current, ...saved }),
                    ),
                  }),
                ]
              : [],
          saved,
          agent: "Muse Spark",
        });
      } catch (e) {
        push({
          role: "bot",
          text: tc(errorKey((e as Error).message)),
          error: true,
        });
      } finally {
        setWorking(null);
        setBusy("Muse Spark agent", false);
      }
    },
    [apply, note, push, setBusy, setSubject, setMsgs, locale, tc, ft],
  );

  const onVoice = useCallback(
    async (wav: Blob) => {
      setWorking("Listening back");
      setBusy("Muse Voice Transcribe", true);
      try {
        const form = new FormData();
        form.append("audio", wav, "speech.wav");
        const res = await fetch("/api/voice", { method: "POST", body: form });
        const data = (await res.json()) as {
          transcript?: string;
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? "model");
        const words = data.transcript?.split(/\s+/).filter(Boolean).length ?? 0;
        note(
          "model",
          "Muse Voice Transcribe",
          words ? `Heard ${words} words` : "Heard nothing clear",
        );
        setBusy("Muse Voice Transcribe", false);
        if (!words) {
          setWorking(null);
          push({
            role: "bot",
            text: "I didn't quite catch that. Try again a little closer to the microphone, or type it.",
            error: true,
          });
          return;
        }
        await send(data.transcript ?? "", "voice");
      } catch (e) {
        setWorking(null);
        setBusy("Muse Voice Transcribe", false);
        push({
          role: "bot",
          text: tc(errorKey((e as Error).message)),
          error: true,
        });
      }
    },
    [note, push, send, setBusy],
  );

  const onPhoto = useCallback(
    async (file: File) => {
      let img: Awaited<ReturnType<typeof shrink>>;
      try {
        img = await shrink(file);
      } catch {
        push({
          role: "bot",
          text: "That file didn't open as a photo. Try a JPEG or PNG picture of the letter.",
          error: true,
        });
        return;
      }
      push({ role: "user", text: "Here's a letter", image: img.dataUrl });
      const myEpoch = epoch.current;
      setWorking("Finding the letter in your photo");
      setBusy("SAM 3.1", true);
      setBusy("Letter reader", true);
      try {
        const res = await fetch("/api/letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: img.dataUrl }),
        });
        const data = (await res.json()) as {
          readable?: boolean;
          box?: LetterView["box"];
          saved?: Answers;
          reading?: Omit<LetterView, "image" | "w" | "h" | "box">;
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? "model");
        if (myEpoch !== epoch.current) return;
        if (data.box) note("model", "SAM 3.1", "Found the letter in the photo");
        if (!data.readable || !data.reading) {
          push({
            role: "bot",
            text: "I couldn't read that one. A flat, well-lit photo of the whole page works best.",
            error: true,
          });
          return;
        }
        note(
          "model",
          "Letter reader",
          `Read ${data.reading.kind ?? "a letter"}${data.reading.from ? ` from ${data.reading.from}` : ""}`,
        );
        const saved = data.saved ?? {};
        if (Object.keys(saved).length) apply(saved, "letter");
        push({
          role: "bot",
          text: Object.keys(saved).length
            ? "I've added what it shows to your check. Change anything that looks different in Details."
            : "Nothing in it changes your check, but here's what it says.",
          saved,
          letter: {
            image: img.dataUrl,
            w: img.width,
            h: img.height,
            box: data.box ?? null,
            ...data.reading,
          },
        });
      } catch (e) {
        push({
          role: "bot",
          text: tc(errorKey((e as Error).message)),
          error: true,
        });
      } finally {
        setWorking(null);
        setBusy("SAM 3.1", false);
        setBusy("Letter reader", false);
      }
    },
    [apply, note, push, setBusy],
  );

  // Answers given on the question card in the chat read back as a chat turn.
  const onAnswer = useCallback(
    (f: FactId, v: Answers[FactId], extra: Answers = {}) => {
      const next = { ...answersRef.current, [f]: v, ...extra };
      const before = evaluate(answersRef.current);
      const after = evaluate(next);
      apply({ [f]: v, ...extra }, "form");
      const said = ft.show(next, f);
      push({
        role: "user",
        text: said,
        qa: { q: ft.ask(f, subjectRef.current), a: said },
      });
      const gained = SCHEMES.filter(
        (s) =>
          after[s.id]?.status === "likely" && before[s.id]?.status !== "likely",
      ).map((s) => s.name);
      push({
        role: "bot",
        text: "",
        notes: [
          gained.length
            ? tc("savedNew", {
                progress: ft.progress(after),
                names: gained.join(", "),
              })
            : tc("saved", { progress: ft.progress(after) }),
        ],
      });
    },
    [apply, push, ft, tc],
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
          <p className="bubble plain">{tc("hello")}</p>
          <p className="bubble plain">{tc("howTo")}</p>
        </div>
        {msgs.map((m, i) => (
          <Message key={m.id} m={m} last={i === msgs.length - 1} />
        ))}
        {!working && !playing && next && (
          <QuestionCard key={next.f} f={next.f} onAnswer={onAnswer} inChat />
        )}
        {!msgs.length && !asked && !playing && (
          <div className="life-events">
            <span className="hint">{tc("startFrom")}</span>
            <div className="chips">
              {LIFE_EVENTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setFocus(e.focus);
                    push({ role: "user", text: te(e.id as "job") });
                  }}
                >
                  {te(e.id as "job")}
                </button>
              ))}
            </div>
          </div>
        )}
        {!working && !next && <AskChips onAsk={(q) => void send(q)} />}
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
      <Composer
        onSend={(t) => void send(t)}
        onVoice={(w) => void onVoice(w)}
        onPhoto={(f) => void onPhoto(f)}
        busy={Boolean(working) || playing}
        quiet={Boolean(next) && !working}
      />
    </>
  );
}

function Message({ m, last }: { m: Msg; last: boolean }) {
  const ft = useFactText();
  const tc = useTranslations("chat");
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const savedKeys = ORDER.filter((k) => m.saved?.[k] !== undefined);
  if (m.role === "user")
    return (
      <div className="msg me">
        {m.image && (
          // biome-ignore lint/performance/noImgElement: a data URL of the person's own photo; next/image can't optimise it
          <img className="thumb" src={m.image} alt="Your letter" />
        )}
        <div className="bubble">
          {m.qa ? (
            <>
              <span className="qa-q">{m.qa.q}</span>
              {m.qa.a}
            </>
          ) : (
            m.text
          )}
        </div>
        {m.via === "voice" && (
          <span className="who">
            <Icon name="mic" size={12} /> {tc("saidAloud")}
          </span>
        )}
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
              {ft.label(k)}: {ft.show(m.saved ?? {}, k)}
            </span>
          ))}
        </div>
      )}
      {m.letter && <LetterCard l={m.letter} />}
      {m.text && <p className="bubble plain">{m.text}</p>}
      {!m.error && m.text && (
        <div className={`msg-actions${last ? " show" : ""}`}>
          <button
            type="button"
            className="iconbtn sm"
            aria-label="Helpful"
            aria-pressed={rated === "up"}
            onClick={() => setRated("up")}
          >
            <Icon name="thumbup" size={16} />
          </button>
          <button
            type="button"
            className="iconbtn sm"
            aria-label="Not helpful"
            aria-pressed={rated === "down"}
            onClick={() => setRated("down")}
          >
            <Icon name="thumbdown" size={16} />
          </button>
          <button
            type="button"
            className="iconbtn sm"
            aria-label={copied ? "Copied" : "Copy"}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(m.text)
                .then(() => setCopied(true));
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

function AskChips({ onAsk }: { onAsk: (q: string) => void }) {
  const { states, subject } = useCheck();
  const t = useTranslations("chat");
  const top = SCHEMES.find((s) => states[s.id]?.status === "likely");
  if (!top) return null;
  const who = callerPhrase(subject);
  const asks = [
    t("askFirst"),
    t("askExplain", { name: top.name }),
    who === "I" ? t("askClashMe") : t("askClashThey", { who }),
  ];
  return (
    <div className="ask-chips">
      <span className="hint">{t("askTitle")}</span>
      {asks.map((q) => (
        <button key={q} type="button" onClick={() => onAsk(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
