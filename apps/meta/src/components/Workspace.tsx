"use client";

// The check workspace (Lovart layout, Beacon v4): chat on the left, the agent canvas in the
// middle, Details on the right. On phones the three become tabs at the bottom.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Activity } from "@/components/check/Activity";
import { SchemeSheet } from "@/components/check/Board";
import { Constellation } from "@/components/check/Constellation";
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
  const [details, setDetails] = useState(false);
  const [view, setView] = useState<MobileView>("chat");
  const { reset, hydrated, next, apply, asked, editing, subject, announce, states, setSubject, edit } = useCheck();
  const found = count(states, "likely") + count(states, "check");
  const [playing, setPlaying] = useState<Example | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [exampleName, setExampleName] = useState<string | null>(null);


  // Deep link: /check#example=margaret plays that example.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once after answers load
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const m = /example=(\w+)/.exec(window.location.hash);
      const ex = EXAMPLES.find((e) => e.id === m?.[1]);
      if (ex) {
        history.replaceState(null, "", "/check");
        play(ex);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [hydrated]);
  useEffect(() => {
    try {
      setExampleName(localStorage.getItem("beacon:example"));
    } catch {
      /* fine */
    }
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
      announce("That's every answer that matters for this example. Try your own whenever you're ready, or ask me anything about these results.");
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
    const name = ex.name.split(",")[0] ?? ex.name;
    setExampleName(name);
    try {
      localStorage.setItem("beacon:example", name);
    } catch {
      /* fine */
    }
    setSubject({ who: "other", label: name });
    setTimeout(() => announce(`Here's a made-up example: ${ex.name}. ${ex.line} Watch the results light up as each answer goes in.`), 50);
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
        {chat !== "full" && (
          <>
            <span className="divider wide-only" aria-hidden="true" />
            <span className="title wide-only">
              {exampleName ? `${exampleName}'s example` : subject.who === "me" ? "Your check" : `Check for ${subject.label}`}
            </span>
          </>
        )}
        <span className="spacer" />
        {chat === "full" ? (
          <button type="button" className="btn ghost small" onClick={() => setChat("open")}>
            <Icon name="shrink" size={18} /> Exit full view
          </button>
        ) : (
          <>
            <div className="menu-wrap">
              <button
                type="button"
                className="btn ghost small"
                aria-expanded={menu}
                onClick={() => (playing ? setPlaying(null) : setMenu((m) => !m))}
                data-testid="examples"
              >
                <Icon name={playing ? "stop" : "play"} size={16} />
                <span>{playing ? "Stop" : "Example"}</span>
              </button>
              {menu && (
                <div className="menu" role="menu">
                  {asked > 0 && !exampleName && <p className="menu-note">An example replaces the answers on this device.</p>}
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
              <div className="menu-wrap">
                <button type="button" className="btn ghost small" onClick={() => setConfirm((c) => !c)} aria-expanded={confirm} data-testid="restart">
                  <Icon name="restart" size={16} />
                  <span className="wide-label">Start again</span>
                </button>
                {confirm && (
                  <div className="menu confirm" role="dialog" aria-label="Start again">
                    <p>Start again? This clears every answer on this device.</p>
                    <div className="row">
                      <button type="button" className="btn small" onClick={() => {
                        setConfirm(false);
                        setPlaying(null);
                        setExampleName(null);
                        reset();
                      }}>
                        Start again
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => setConfirm(false)}>
                        Keep my answers
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
          <ChatPanel playing={Boolean(playing)} />
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
              edit(null);
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
            {v === "canvas" && found > 0 && <span className="badge">{found}</span>}
          </button>
        ))}
      </nav>
      <SchemeSheet />
    </div>
  );
}

function Canvas() {
  const { states, asked } = useCheck();
  const open = count(states, "open");
  const settled = SCHEMES.length - open;
  const found = count(states, "likely") + count(states, "check") + count(states, "unlock");
  return (
    <>
      <div className="canvas-top">
        <Activity />
        {asked > 0 && (
          <div className="progress">
            <div className="meter" role="progressbar" aria-label="Kinds of help checked" aria-valuemin={0} aria-valuemax={SCHEMES.length} aria-valuenow={settled}>
              <i style={{ width: `${(settled / SCHEMES.length) * 100}%` }} />
            </div>
            <span className="meter-label" data-testid="stats">
              {settled} of {SCHEMES.length} checked
            </span>
          </div>
        )}
      </div>
      {found ? (
        <Results />
      ) : (
        <div className="calm" data-testid="calm">
          <div className="lamp" aria-hidden="true">
            <i />
            <i />
            <i />
            <span />
          </div>
          <p>{asked === 0 ? "Your results light up here as you answer." : "Keep going. Results light up here."}</p>
        </div>
      )}
      <Constellation />
    </>
  );
}
