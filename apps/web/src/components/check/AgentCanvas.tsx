"use client";

import { type PrecheckStatus, SCHEMES, type SchemeId } from "@beacon/rules";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AGENTS,
  type AgentId,
  diff,
  type FeedItem,
  type Move,
  type Snapshot,
  snapshot,
} from "@/lib/agent-feed";
import type { Draft } from "@/lib/answers";
import { Icon } from "../Icon";
import { useFlip } from "./use-flip";

// "Beacon at work" (D-02x canvas): the board beside each question. Lanes hold the ten kinds of support;
// agents move a card when an answer settles it, with the rule and its source in the feed.

const LANES: { status: PrecheckStatus; title: string; empty: string }[] = [
  {
    status: "open",
    title: "Still possible",
    empty: "Nothing left to read",
  },
  {
    status: "already-get",
    title: "Already yours",
    empty: "Anything you already get lands here",
  },
  {
    status: "ruled-out",
    title: "Set aside",
    empty: "Support your answers rule out lands here",
  },
];

const AGENT_ORDER: AgentId[] = ["area", "age", "rules", "planner"];
const FEED_MAX = 8;
const CURSOR_MS = 2400;
const WORKING_MS = 1800;

interface Entry extends FeedItem {
  id: number;
}
interface Cursor {
  x: number;
  y: number;
  shown: boolean;
  /** Near the right edge the label hangs to the left so it isn't cut off */
  flip: boolean;
}

export function AgentCanvas({ draft }: { draft: Draft }) {
  const snap = useMemo(
    () => snapshot(draft.situation, draft.progress),
    [draft.situation, draft.progress],
  );
  const prev = useRef<Snapshot | null>(null);
  const nextId = useRef(1);
  const [feed, setFeed] = useState<Entry[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState<Partial<Record<AgentId, number>>>({});
  const [cursors, setCursors] = useState<Partial<Record<AgentId, Cursor>>>({});
  const [announce, setAnnounce] = useState("");

  const board = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<SchemeId, HTMLElement>());

  // Compare with the last snapshot and turn the difference into agent activity.
  useEffect(() => {
    const { items, moves: m } = diff(prev.current, snap);
    prev.current = snap;
    if (!items.length && !m.length) return;
    const now = Date.now();
    setFeed((f) =>
      [
        ...items.map((it) => ({ ...it, id: nextId.current++ })).reverse(),
        ...f,
      ].slice(0, FEED_MAX),
    );
    setMoves(m);
    setBusy((b) => {
      const out = { ...b };
      for (const it of items) out[it.agent] = now;
      return out;
    });
    if (items[0])
      setAnnounce(`${AGENTS[items[0].agent].name}: ${items[0].text}`);
  }, [snap]);

  // Cards that changed lane glide there (useFlip); the agent that moved one flies its cursor to it.
  const rects = useFlip(cards, snap);
  useLayoutEffect(() => {
    const host = board.current;
    if (!host || !moves.length) return;
    const origin = host.getBoundingClientRect();
    const next: Partial<Record<AgentId, Cursor>> = {};
    for (const m of moves) {
      const r = rects.current.get(m.scheme);
      if (!r) continue;
      const x = r.right - origin.left - 14;
      next[m.agent] = {
        x,
        y: r.bottom - origin.top - 6,
        shown: true,
        flip: x > origin.width - 110,
      };
    }
    // Only the agents that just acted show their cursor; earlier ones step back.
    setCursors((c) => ({
      ...Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, { ...v, shown: false }]),
      ),
      ...next,
    }));
    const t = window.setTimeout(
      () =>
        setCursors((c) =>
          Object.fromEntries(
            Object.entries(c).map(([k, v]) => [k, { ...v, shown: false }]),
          ),
        ),
      CURSOR_MS,
    );
    return () => window.clearTimeout(t);
  }, [moves, rects]);

  // Agents look busy for a moment after they act.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 600);
    return () => window.clearInterval(id);
  }, []);
  const working = (a: AgentId) => Date.now() - (busy[a] ?? 0) < WORKING_MS;

  const byStatus = (st: PrecheckStatus) =>
    SCHEMES.filter((s) => snap.status[s.id] === st);
  const count = (st: PrecheckStatus) => byStatus(st).length;
  const moved = new Set(moves.map((m) => m.scheme));

  return (
    <section className="agent-canvas" aria-labelledby="canvas-title">
      <header className="ac-head">
        <div className="flex items-center gap-2">
          <span className="ac-live" aria-hidden="true" />
          <h2 id="canvas-title" className="t-title">
            Beacon at work
          </h2>
        </div>
        <p className="small muted">
          {snap.questionsLeft === 0
            ? "All answered. Ready to read the rules."
            : `${snap.questionsLeft} question${snap.questionsLeft === 1 ? "" : "s"} left. Each answer settles more.`}
        </p>
      </header>

      <ul className="ac-agents" aria-label="Agents">
        {AGENT_ORDER.map((a) => (
          <li
            key={a}
            aria-label={`${AGENTS[a].name}: ${AGENTS[a].job}`}
            title={AGENTS[a].job}
            className={`ac-agent ag-${a} ${working(a) ? "is-working" : ""}`}
          >
            <span className="ac-avatar" aria-hidden="true">
              {AGENTS[a].name.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="ac-agent-name">
                {AGENTS[a].name.replace(/ agent$/, "")}
              </span>
              <span className="ac-agent-state">
                {working(a) ? "Working" : "Watching"}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="ac-board" ref={board}>
        {LANES.map((lane) => (
          <section
            key={lane.status}
            className={`ac-lane lane-${lane.status}`}
            aria-label={`${lane.title}: ${count(lane.status)}`}
          >
            <h3 className="ac-lane-title">
              {lane.title}
              <span className="ac-count">{count(lane.status)}</span>
            </h3>
            <ul className="ac-cards">
              {byStatus(lane.status).map((s) => (
                <li
                  key={s.id}
                  ref={(el) => {
                    if (el) cards.current.set(s.id, el);
                    else cards.current.delete(s.id);
                  }}
                  className={`ac-card ${moved.has(s.id) ? "just-moved" : ""}`}
                  title={snap.reason[s.id]}
                >
                  <span className="ac-card-name">{s.name}</span>
                  {lane.status !== "open" && (
                    <span className="ac-card-meta">{snap.reason[s.id]}</span>
                  )}
                </li>
              ))}
              {count(lane.status) === 0 && (
                <li className="ac-empty">{lane.empty}</li>
              )}
            </ul>
          </section>
        ))}
        {AGENT_ORDER.map((a) => {
          const c = cursors[a];
          if (!c) return null;
          return (
            <span
              key={a}
              aria-hidden="true"
              className={`ac-cursor ag-${a} ${c.shown ? "is-shown" : ""} ${c.flip ? "is-flip" : ""}`}
              style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden="true"
              >
                <title>Agent cursor</title>
                <path d="M2 1l13 7-6 1.5L6.5 16z" />
              </svg>
              <span className="ac-cursor-label">{AGENTS[a].name}</span>
            </span>
          );
        })}
      </div>

      <section className="ac-feed" aria-labelledby="feed-title">
        <h3 id="feed-title" className="ac-lane-title">
          What the agents did
        </h3>
        {feed.length === 0 ? (
          <p className="small muted">
            Answer the question and watch the agents settle what they can.
          </p>
        ) : (
          <ol className="ac-feed-list">
            {feed.map((e) => (
              <li key={e.id} className={`ac-item tone-${e.tone}`}>
                <span className={`ac-dot ag-${e.agent}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span>
                    <strong>{AGENTS[e.agent].name}.</strong> {e.text}
                  </span>
                  {e.source && (
                    <a
                      className="ac-source"
                      href={e.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="link" size={14} /> {e.source.label}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="small muted ac-foot">
        <Icon name="lock" size={16} className="mt-0.5 flex-none" />
        These agents run in your browser. Only the first half of your postcode
        leaves it, to find your council.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

/** Phone and tablet: one line of what just happened, with counts, above the question. */
export function AgentStrip({ draft }: { draft: Draft }) {
  const snap = useMemo(
    () => snapshot(draft.situation, draft.progress),
    [draft.situation, draft.progress],
  );
  const prev = useRef<Snapshot | null>(null);
  const [last, setLast] = useState<FeedItem | null>(null);
  useEffect(() => {
    const { items } = diff(prev.current, snap);
    prev.current = snap;
    if (items[0]) setLast(items[0]);
  }, [snap]);
  const n = (st: PrecheckStatus) =>
    SCHEMES.filter((s) => snap.status[s.id] === st).length;
  return (
    <details className="agent-strip card">
      <summary>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 font-bold">
            <span className="ac-live" aria-hidden="true" />
            Beacon at work
          </span>
          <span className="small muted">
            {n("open")} still possible · {n("already-get")} yours ·{" "}
            {n("ruled-out")} set aside
          </span>
          {last && (
            <span className={`small ac-item ac-strip-last tone-${last.tone}`}>
              <span className={`ac-dot ag-${last.agent}`} aria-hidden="true" />
              <span>
                <strong>{AGENTS[last.agent].name}.</strong> {last.text}
              </span>
            </span>
          )}
        </span>
        <Icon name="chevron-down" className="chev" />
      </summary>
      <AgentCanvasLanesOnly snap={snap} />
    </details>
  );
}

function AgentCanvasLanesOnly({ snap }: { snap: Snapshot }) {
  return (
    <div className="stack gap-3 pt-2">
      {LANES.map((lane) => {
        const items = SCHEMES.filter((s) => snap.status[s.id] === lane.status);
        return (
          <div key={lane.status} className="stack gap-1">
            <p className="ac-lane-title">
              {lane.title} <span className="ac-count">{items.length}</span>
            </p>
            <p className="small">
              {items.length ? items.map((s) => s.name).join(", ") : lane.empty}
            </p>
          </div>
        );
      })}
    </div>
  );
}
