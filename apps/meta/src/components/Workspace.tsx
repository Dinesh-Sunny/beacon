"use client";

// The check workspace (Lovart layout, Beacon v4): chat on the left, the agent canvas in the
// middle, Details on the right. On phones the three become tabs at the bottom.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentPanel } from "@/components/check/AgentPanel";
import { Board, SchemeSheet } from "@/components/check/Board";
import { DetailsPanel } from "@/components/details/DetailsPanel";
import { Icon, Logo } from "@/components/Icon";
import { Results } from "@/components/results/Results";
import { UNSURE } from "@/engine/facts";
import { count, SCHEMES } from "@/engine/rules";
import { CheckProvider, useCheck } from "@/lib/check-store";
import { EXAMPLES, type Example } from "@/lib/examples";

type ChatMode = "open" | "hidden" | "full";
type MobileView = "chat" | "canvas" | "details";

export function Workspace() {
  return (
    <CheckProvider>
      <Shell />
    </CheckProvider>
  );
}

function Shell() {
  const [chat, setChat] = useState<ChatMode>("open");
  const [details, setDetails] = useState(true);
  const [view, setView] = useState<MobileView>("details");
  const { reset, hydrated, next, apply, asked, editing } = useCheck();
  const [playing, setPlaying] = useState<Example | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1200px)").matches) setChat("hidden");
  }, []);
  useEffect(() => {
    if (editing) {
      setDetails(true);
      setView("details");
    }
  }, [editing]);

  // Example player: answers whatever the planner asks next, one step at a time.
  useEffect(() => {
    if (!playing) return;
    if (!next) {
      setPlaying(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => apply({ [next.f]: playing.answers[next.f] ?? UNSURE }, "example"), reduce ? 0 : 800);
    return () => clearTimeout(t);
  }, [playing, next, apply]);

  const play = (ex: Example) => {
    setMenu(false);
    reset();
    setPlaying(ex);
    setView("canvas");
  };

  return (
    <div className="ws" data-chat={chat} data-details={details ? "open" : "closed"} data-view={view}>
      <header className="strip">
        <Link href="/" className="brand" aria-label="Beacon home">
          <Logo />
          <span>Beacon</span>
        </Link>
        {chat === "hidden" ? (
          <button type="button" className="iconbtn wide-only" onClick={() => setChat("open")} aria-label="Show chat" title="Show chat" data-testid="show-chat">
            <Icon name="panel" />
          </button>
        ) : chat === "open" ? (
          <span className="chat-tools wide-only">
            <button type="button" className="iconbtn" onClick={() => setChat("full")} aria-label="Full view" title="Full view">
              <Icon name="expand" />
            </button>
            <button type="button" className="iconbtn" onClick={() => setChat("hidden")} aria-label="Hide chat" title="Hide chat" data-testid="hide-chat">
              <Icon name="panel" />
            </button>
          </span>
        ) : null}
        <span className="spacer" />
        {chat === "full" ? (
          <button type="button" className="btn ghost small" onClick={() => setChat("open")}>
            <Icon name="shrink" size={18} /> Exit full view
          </button>
        ) : (
          <>
            <div className="menu-wrap">
              <button type="button" className="btn ghost small" aria-expanded={menu} onClick={() => setMenu((m) => !m)} data-testid="examples">
                <Icon name={playing ? "stop" : "play"} size={16} />
                <span className="wide-label">{playing ? "Playing" : "Try an example"}</span>
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
            <button
              type="button"
              className="btn ghost small wide-only"
              aria-pressed={details}
              onClick={() => setDetails((d) => !d)}
              data-testid="details-toggle"
            >
              <Icon name="person" size={18} /> Details
            </button>
          </>
        )}
      </header>

      <aside className="chat" aria-label="Chat with Beacon">
        <div className="chat-inner">
          <ChatPanel />
        </div>
      </aside>

      <main className="canvas" id="canvas">
        <div className="canvas-inner">{hydrated ? <Canvas /> : null}</div>
      </main>

      <aside className="details-col" aria-label="Details">
        {hydrated ? (
          <DetailsPanel
            onClose={() => {
              setDetails(false);
              setView("canvas");
            }}
          />
        ) : null}
      </aside>

      <nav className="tabbar" aria-label="Views">
        {(
          [
            ["chat", "chat", "Chat"],
            ["canvas", "spark", "Results"],
            ["details", "person", "Details"],
          ] as const
        ).map(([v, icon, label]) => (
          <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => setView(v)} data-testid={`view-${v}`}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      <SchemeSheet />
    </div>
  );
}

function Canvas() {
  const { next, states } = useCheck();
  const open = count(states, "open");
  const settled = SCHEMES.length - open;
  return (
    <>
      <div className="progress">
        <div className="meter" role="progressbar" aria-label="Schemes checked" aria-valuemin={0} aria-valuemax={SCHEMES.length} aria-valuenow={settled}>
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
      <AgentPanel />
      {next ? null : <Results />}
      <Board />
    </>
  );
}
