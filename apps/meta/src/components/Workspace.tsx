"use client";

// The check workspace in the Lovart layout: a slim strip on top, the chat panel on the left
// (open, hidden or full view) and the canvas on the right.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentPanel } from "@/components/check/AgentPanel";
import { Board, SchemeSheet } from "@/components/check/Board";
import { QuestionCard } from "@/components/check/QuestionCard";
import { Results } from "@/components/results/Results";
import { Icon, Logo } from "@/components/Icon";
import { UNSURE } from "@/engine/facts";
import { count, SCHEMES } from "@/engine/rules";
import { CheckProvider, useCheck } from "@/lib/check-store";
import { EXAMPLES, type Example } from "@/lib/examples";

type ChatMode = "open" | "hidden" | "full";

export function Workspace() {
  return (
    <CheckProvider>
      <Shell />
    </CheckProvider>
  );
}

function Shell() {
  const [chat, setChat] = useState<ChatMode>("open");
  const { reset, hydrated, next, apply, asked } = useCheck();
  const [playing, setPlaying] = useState<Example | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) setChat("hidden");
  }, []);

  // Example player: answers whatever the planner asks next, one step at a time.
  useEffect(() => {
    if (!playing) return;
    if (!next) {
      setPlaying(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => apply({ [next.f]: playing.answers[next.f] ?? UNSURE }, "example"), reduce ? 0 : 850);
    return () => clearTimeout(t);
  }, [playing, next, apply]);

  const play = (ex: Example) => {
    setMenu(false);
    reset();
    setPlaying(ex);
  };

  return (
    <div className="ws" data-chat={chat}>
      <header className="strip">
        <Link href="/" className="brand" aria-label="Beacon home">
          <Logo />
          <span>Beacon</span>
        </Link>
        {chat === "hidden" ? (
          <button type="button" className="iconbtn" onClick={() => setChat("open")} aria-label="Show chat" title="Show chat" data-testid="show-chat">
            <Icon name="panel" />
          </button>
        ) : chat === "open" ? (
          <>
            <button type="button" className="iconbtn toggle-open" onClick={() => setChat("full")} aria-label="Full view" title="Full view">
              <Icon name="expand" />
            </button>
            <button type="button" className="iconbtn" onClick={() => setChat("hidden")} aria-label="Hide chat" title="Hide chat" data-testid="hide-chat">
              <Icon name="panel" />
            </button>
          </>
        ) : null}
        {chat !== "full" && <span className="divider" aria-hidden="true" />}
        {chat !== "full" && <span className="title">Your check</span>}
        <span className="spacer" />
        {chat === "full" ? (
          <button type="button" className="btn ghost small" onClick={() => setChat("open")}>
            <Icon name="shrink" size={18} /> Exit full view
          </button>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="btn ghost small"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
                data-testid="examples"
              >
                <Icon name={playing ? "stop" : "play"} size={16} /> {playing ? "Playing" : "Example"}
              </button>
              {menu && (
                <div className="menu" role="menu">
                  {EXAMPLES.map((ex) => (
                    <button key={ex.id} type="button" role="menuitem" onClick={() => play(ex)}>
                      <b>{ex.name}</b>
                      <span>{ex.line}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {asked > 0 && (
              <button
                type="button"
                className="iconbtn"
                onClick={() => {
                  setPlaying(null);
                  reset();
                }}
                aria-label="Start again"
                title="Start again"
              >
                <Icon name="restart" />
              </button>
            )}
          </>
        )}
      </header>
      <aside className="chat" aria-label="Chat with Beacon">
        <div className="chat-inner">
          <ChatPanel onClose={() => setChat("hidden")} />
        </div>
      </aside>
      <main className="canvas" id="canvas">
        <div className="canvas-inner">{hydrated ? <Canvas /> : null}</div>
      </main>
      <SchemeSheet />
    </div>
  );
}

function Canvas() {
  const { next, states } = useCheck();
  const open = count(states, "open");
  const settled = SCHEMES.length - open;
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className="stage" ref={scroller}>
      <div className="stage-main">
        <div className="progress">
          <div className="meter" role="progressbar" aria-label="Schemes settled" aria-valuemin={0} aria-valuemax={SCHEMES.length} aria-valuenow={settled}>
            <i style={{ width: `${(settled / SCHEMES.length) * 100}%` }} />
          </div>
          <div className="stats" data-testid="stats">
            <span className="stat likely">
              <b>{count(states, "likely")}</b> likely
            </span>
            <span className="stat">
              <b>{count(states, "check")}</b> worth checking
            </span>
            <span className="stat">
              <b>{open}</b> still open
            </span>
          </div>
        </div>
        {next ? <QuestionCard /> : <Results />}
        <Board />
      </div>
      <div className="side">
        <AgentPanel />
      </div>
    </div>
  );
}
