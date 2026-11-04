"use client";

// The check workspace (Lovart layout, Beacon v4): chat on the left, the agent canvas in the
// middle, Details on the right. On phones the three become tabs at the bottom.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Activity } from "@/components/check/Activity";
import { SchemeSheet } from "@/components/check/Board";
import { Constellation } from "@/components/check/Constellation";
import { FirstLook } from "@/components/check/FirstLook";
import { Narrowing } from "@/components/check/Narrowing";
import { PlaceSync } from "@/components/check/PlaceSync";
import { WatchNotice } from "@/components/check/WatchNotice";
import { DetailsPanel } from "@/components/details/DetailsPanel";
import { Icon, Logo } from "@/components/Icon";
import { PlaceButton } from "@/components/locale/PlaceDialog";
import { SuggestLanguage } from "@/components/locale/SuggestLanguage";
import { Results } from "@/components/results/Results";
import { UNSURE } from "@/engine/facts";
import { count, inPlay } from "@/engine/rules";
import { CheckProvider, useCheck } from "@/lib/check-store";
import { ClaimsProvider } from "@/lib/claims";
import { EXAMPLES, type Example } from "@/lib/examples";
import { readShared } from "@/lib/share";

type ChatMode = "open" | "hidden" | "full";
type MobileView = "chat" | "canvas" | "details";

export function Workspace() {
  return (
    <CheckProvider>
      <ClaimsProvider>
        <Shell />
      </ClaimsProvider>
    </CheckProvider>
  );
}

function Shell() {
  const t = useTranslations("header");
  const tc = useTranslations("chat");
  const [chat, setChat] = useState<ChatMode>("open");
  const [details, setDetails] = useState(false);
  const [view, setView] = useState<MobileView>("chat");
  const {
    reset,
    hydrated,
    next,
    apply,
    asked,
    editing,
    subject,
    announce,
    states,
    setSubject,
    edit,
  } = useCheck();
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
        return;
      }
      // A shared check: answers ride in the fragment, never reach a server, and are validated first.
      void readShared(window.location.hash).then((shared) => {
        if (!shared) return;
        history.replaceState(null, "", "/check");
        reset();
        setSubject(shared.subject);
        apply(shared.answers, "link");
        announce(tc("shared"));
      });
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
      announce(tc("exampleDone"));
      return;
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const t = setTimeout(
      () => apply({ [next.f]: playing.answers[next.f] ?? UNSURE }, "example"),
      reduce ? 0 : 800,
    );
    return () => clearTimeout(t);
  }, [playing, next, apply, announce]);

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
    setTimeout(
      () => announce(tc("examplePlay", { name: ex.name, line: ex.line })),
      50,
    );
    setView("canvas");
  };

  return (
    <div
      className="ws"
      data-chat={chat}
      data-details={details ? "open" : "closed"}
      data-view={view}
    >
      <a className="skip-link" href="#canvas">
        {t("skip")}
      </a>
      <header className="strip">
        <Link
          href="/"
          className="brand"
          aria-label={t("home")}
          transitionTypes={["nav-back"]}
        >
          <Logo />
          <span>Beacon</span>
        </Link>
        {chat === "hidden" ? (
          <button
            type="button"
            className="iconbtn wide-only"
            onClick={() => setChat("open")}
            aria-label={t("showChat")}
            title={t("showChat")}
            data-testid="show-chat"
          >
            <Icon name="panel" />
          </button>
        ) : chat === "open" ? (
          <span className="chat-tools wide-only">
            <button
              type="button"
              className="iconbtn"
              onClick={() => setChat("full")}
              aria-label={t("fullView")}
              title={t("fullView")}
            >
              <Icon name="expand" />
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={() => setChat("hidden")}
              aria-label={t("hideChat")}
              title={t("hideChat")}
              data-testid="hide-chat"
            >
              <Icon name="panel" />
            </button>
          </span>
        ) : null}
        {chat !== "full" && (
          <>
            <span className="divider wide-only" aria-hidden="true" />
            <span className="title wide-only">
              {exampleName
                ? t("exampleOf", { name: exampleName })
                : subject.who === "me"
                  ? t("yourCheck")
                  : t("checkFor", { name: subject.label ?? "" })}
            </span>
          </>
        )}
        <span className="spacer" />
        {chat === "full" ? (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setChat("open")}
          >
            <Icon name="shrink" size={18} /> {t("exitFull")}
          </button>
        ) : (
          <>
            <PlaceButton />
            <div className="menu-wrap">
              <button
                type="button"
                className="btn ghost small"
                aria-expanded={menu}
                onClick={() =>
                  playing ? setPlaying(null) : setMenu((m) => !m)
                }
                data-testid="examples"
              >
                <Icon name={playing ? "stop" : "play"} size={16} />
                <span>{playing ? t("stop") : t("example")}</span>
              </button>
              {menu && (
                <div className="menu" role="menu">
                  {asked > 0 && !exampleName && (
                    <p className="menu-note">{t("exampleReplaces")}</p>
                  )}
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      role="menuitem"
                      onClick={() => play(ex)}
                    >
                      <b>{ex.name}</b>
                      <span>{ex.line}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {asked > 0 && (
              <div className="menu-wrap">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setConfirm((c) => !c)}
                  aria-expanded={confirm}
                  data-testid="restart"
                >
                  <Icon name="restart" size={16} />
                  <span className="wide-label">{t("startAgain")}</span>
                </button>
                {confirm && (
                  <div
                    className="menu confirm"
                    role="dialog"
                    aria-label={t("startAgain")}
                  >
                    <p>{t("startAgainAsk")}</p>
                    <div className="row">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setConfirm(false);
                          setPlaying(null);
                          setExampleName(null);
                          reset();
                        }}
                      >
                        {t("startAgain")}
                      </button>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setConfirm(false)}
                      >
                        {t("keepAnswers")}
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
              <Icon name="person" size={18} /> {t("details")}
            </button>
          </>
        )}
      </header>

      <aside className="chat" aria-label={t("chatWith")}>
        <div className="chat-inner">
          <SuggestLanguage />
          <ChatPanel playing={Boolean(playing)} />
          <WatchNotice />
          <PlaceSync />
        </div>
      </aside>

      <main className="canvas" id="canvas">
        <div className="canvas-inner">
          {hydrated ? (
            <Canvas onExample={() => play(EXAMPLES[0] as Example)} />
          ) : null}
        </div>
      </main>

      <aside className="details-col" aria-label={t("details")}>
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

      <nav className="tabbar" aria-label={t("views")}>
        {(
          [
            ["chat", "chat", t("chat")],
            ["canvas", "spark", t("results")],
            ["details", "person", t("details")],
          ] as const
        ).map(([v, icon, label]) => (
          <button
            key={v}
            type="button"
            aria-current={view === v ? "page" : undefined}
            onClick={() => setView(v)}
            data-testid={`view-${v}`}
          >
            <Icon name={icon} />
            {label}
            {v === "canvas" && found > 0 && (
              <span className="badge">{found}</span>
            )}
          </button>
        ))}
      </nav>
      <SchemeSheet />
    </div>
  );
}

function Canvas({ onExample }: { onExample: () => void }) {
  const t = useTranslations("header");
  const { states, asked } = useCheck();
  const open = count(states, "open");
  const total = inPlay(states).length;
  const settled = total - open;
  const found =
    count(states, "likely") + count(states, "check") + count(states, "unlock");
  return (
    <>
      <div className="canvas-top">
        <Activity />
        {asked > 0 && settled < total && (
          <div className="progress">
            <div
              className="meter"
              role="progressbar"
              aria-label={t("checkedLabel")}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={settled}
            >
              <i style={{ width: `${(settled / total) * 100}%` }} />
            </div>
            <span className="meter-label" data-testid="stats">
              {t("checked", { done: settled, total })}
            </span>
          </div>
        )}
      </div>
      {found ? (
        <Results />
      ) : asked === 0 ? (
        <FirstLook onExample={onExample} />
      ) : (
        <Narrowing />
      )}
      {found > 0 && <Constellation />}
    </>
  );
}
