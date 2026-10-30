"use client";

import {
  type PrecheckStatus,
  SCHEMES,
  type SchemeId,
  type StepId,
  schemeById,
} from "@beacon/rules";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AGENTS,
  type AgentId,
  diff,
  type FeedGroup,
  type FeedItem,
  type Move,
  type Snapshot,
  snapshot,
} from "@/lib/agent-feed";
import type { Draft } from "@/lib/answers";
import { Icon } from "../Icon";
import { useFlip } from "./use-flip";

// "Beacon at work" (D-02x canvas): the board beside each question. Lanes hold the ten kinds of support;
// agents move a card when an answer settles it, and every answer gets a line in the feed with its source.

const LANES: { status: PrecheckStatus; title: string; empty: string }[] = [
  { status: "open", title: "Still possible", empty: "Nothing left to read" },
  {
    status: "already-get",
    title: "Already yours",
    empty: "Anything you already get lands here",
  },
  {
    status: "ruled-out",
    title: "Unlikely right now",
    empty: "Support your answers rule out lands here",
  },
];

const AGENT_ORDER: AgentId[] = ["area", "age", "rules", "planner"];
const GROUPS_MAX = 5;
const CURSOR_MS = 2400;
const ACTIVE_MS = 1800;

interface Group extends FeedGroup {
  id: number;
}
interface Cursor {
  x: number;
  y: number;
  shown: boolean;
  /** Near the right edge the label hangs to the left so it isn't cut off */
  flip: boolean;
}

// One check per tab: the agents' memory survives the review page and Change round trips, and the
// canvas and the phone strip share it, so the agents run once per answer.
interface AgentState {
  groups: Group[];
  moves: Move[];
}
// Each update replaces `state` with a new object, so React (and its compiler) sees the change.
const store = {
  key: "",
  prev: null as Snapshot | null,
  nextId: 1,
  state: { groups: [], moves: [] } as AgentState,
  listeners: new Set<() => void>(),
};
const subscribe = (fn: () => void) => {
  store.listeners.add(fn);
  return () => {
    store.listeners.delete(fn);
  };
};
const getState = () => store.state;

/** Runs the agents on each new answer and keeps their history for this tab's check. */
function useAgents(draft: Draft, current?: StepId) {
  const snap = useMemo(
    () => snapshot(draft.situation, draft.progress),
    [draft.situation, draft.progress],
  );
  const key = useMemo(
    () => JSON.stringify([draft.situation, draft.progress]),
    [draft.situation, draft.progress],
  );
  const state = useSyncExternalStore(subscribe, getState, getState);
  useEffect(() => {
    if (store.key === key) return;
    store.key = key;
    // A fresh check (nothing answered, nothing chosen) starts the agents' memory again.
    const fresh =
      Object.keys(snap.answered).length === 0 && snap.birthYear === undefined;
    const { group, moves } = diff(store.prev, snap, current);
    store.prev = snap;
    const before = fresh ? [] : store.state.groups;
    // Continue after a choice that already moved cards adds nothing new to say.
    const repeat = group?.filler && before[0]?.title === group.title;
    store.state = {
      moves,
      groups:
        group && !repeat
          ? [{ ...group, id: store.nextId++ }, ...before].slice(0, GROUPS_MAX)
          : before,
    };
    for (const fn of store.listeners) fn();
  }, [key, snap, current]);
  return { snap, groups: state.groups, moves: state.moves };
}

function FeedLine({ e }: { e: FeedItem }) {
  return (
    <li className={`ac-item tone-${e.tone}`}>
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
  );
}

export function AgentCanvas({
  draft,
  questionsLeft,
  current,
}: {
  draft: Draft;
  current?: StepId;
  /** Same count as the "Your answers" list, so the two never disagree */
  questionsLeft: number;
}) {
  const { snap, groups, moves } = useAgents(draft, current);
  const [cursors, setCursors] = useState<Partial<Record<AgentId, Cursor>>>({});
  const [active, setActive] = useState<Partial<Record<AgentId, number>>>({});
  const board = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<SchemeId, HTMLElement>());
  const latest = groups[0];

  // Which agents acted on the latest answer, and how many cards each moved.
  useEffect(() => {
    if (!latest) return;
    const counts: Partial<Record<AgentId, number>> = {};
    for (const it of latest.items) counts[it.agent] = counts[it.agent] ?? 0;
    for (const m of moves) counts[m.agent] = (counts[m.agent] ?? 0) + 1;
    setActive(counts);
    const t = window.setTimeout(() => setActive({}), ACTIVE_MS);
    return () => window.clearTimeout(t);
  }, [latest, moves]);

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

  const byStatus = (st: PrecheckStatus) =>
    SCHEMES.filter((s) => snap.status[s.id] === st);
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
          {questionsLeft === 0
            ? "All answered. Ready to read the rules."
            : `${questionsLeft} question${questionsLeft === 1 ? "" : "s"} left.`}{" "}
          The agents ran in{" "}
          {snap.ms < 1
            ? "under 1"
            : Math.round(snap.ms).toLocaleString("en-GB")}{" "}
          ms on your device.
        </p>
      </header>

      <ul className="ac-agents" aria-label="Agents">
        {AGENT_ORDER.map((a) => {
          const n = active[a];
          return (
            <li
              key={a}
              aria-label={`${AGENTS[a].name}: ${AGENTS[a].job}`}
              title={AGENTS[a].job}
              className={`ac-agent ag-${a} ${n !== undefined ? "is-working" : ""}`}
            >
              <span className="ac-avatar" aria-hidden="true">
                {AGENTS[a].name.charAt(0)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="ac-agent-name">
                  {AGENTS[a].name.replace(/ agent$/, "")}
                </span>
                <span className="ac-agent-state">
                  {n === undefined
                    ? "Ready"
                    : n === 0
                      ? "Checked"
                      : `Moved ${n}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {latest && (
        <section className="ac-latest" aria-labelledby="latest-title">
          <h3 id="latest-title" className="ac-lane-title">
            After &quot;{latest.title}&quot;
          </h3>
          <ol className="ac-feed-list ac-latest-list">
            {latest.items.slice(0, 2).map((e) => (
              <FeedLine key={`${latest.id}-${e.agent}-${e.text}`} e={e} />
            ))}
          </ol>
          {latest.items.length > 2 && (
            <details className="ac-more">
              <summary>{latest.items.length - 2} more from this answer</summary>
              <ol className="ac-feed-list ac-plain pt-2">
                {latest.items.slice(2).map((e) => (
                  <FeedLine key={`${latest.id}-${e.agent}-${e.text}`} e={e} />
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      <div className="ac-board" ref={board}>
        {LANES.map((lane) => {
          const items = byStatus(lane.status);
          return (
            <section
              key={lane.status}
              className={`ac-lane lane-${lane.status}`}
              aria-label={`${lane.title}: ${items.length}`}
            >
              <h3 className="ac-lane-title">
                {lane.title}
                <span className="ac-count">{items.length}</span>
              </h3>
              <ul className="ac-cards">
                {items.map((s) => (
                  <li
                    key={s.id}
                    ref={(el) => {
                      if (el) cards.current.set(s.id, el);
                      else cards.current.delete(s.id);
                    }}
                    className={`ac-card ${moved.has(s.id) ? "just-moved" : ""}`}
                  >
                    {lane.status === "open" ? (
                      <span className="ac-card-name">{s.name}</span>
                    ) : (
                      <details className="ac-why">
                        <summary className="ac-card-name">{s.name}</summary>
                        <span className="ac-card-meta">
                          {snap.reason[s.id]}
                        </span>
                        <a
                          className="ac-source"
                          href={`https://www.gov.uk${schemeById(s.id).govukPaths[0] ?? ""}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name="link" size={14} /> GOV.UK
                        </a>
                      </details>
                    )}
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="ac-empty">{lane.empty}</li>
                )}
              </ul>
            </section>
          );
        })}
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

      {groups.length > 1 && (
        <section className="ac-feed" aria-labelledby="feed-title">
          <h3 id="feed-title" className="ac-lane-title">
            Earlier answers
          </h3>
          <ol className="ac-feed-list">
            {groups.slice(1).map((g) => (
              <li key={g.id} className="ac-group">
                <p className="ac-group-title">After &quot;{g.title}&quot;</p>
                <ol className="ac-feed-list ac-plain">
                  {g.items.map((e) => (
                    <FeedLine key={`${g.id}-${e.agent}-${e.text}`} e={e} />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="small muted ac-foot">
        <Icon name="lock" size={16} className="mt-0.5 flex-none" />
        These agents run on your device. Only the first half of your postcode
        leaves it, to find your council.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {latest?.summary ?? ""}
      </p>
    </section>
  );
}

/** Phone and tablet: what the latest answer did, with counts, above the question. */
export function AgentStrip({
  draft,
  current,
}: {
  draft: Draft;
  current?: StepId;
}) {
  const { snap, groups } = useAgents(draft, current);
  const latest = groups[0];
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
            {n("ruled-out")} unlikely
          </span>
          {latest && (
            <span className="small ac-strip-last">
              <span>{latest.summary}</span>
            </span>
          )}
        </span>
        <Icon name="chevron-down" className="chev" />
      </summary>
      {latest && (
        <ol className="ac-feed-list ac-plain pt-3">
          {latest.items.slice(0, 3).map((e) => (
            <FeedLine key={`${latest.id}-${e.agent}-${e.text}`} e={e} />
          ))}
        </ol>
      )}
      <div className="stack gap-3 pt-3">
        {LANES.map((lane) => {
          const items = SCHEMES.filter(
            (s) => snap.status[s.id] === lane.status,
          );
          return (
            <div key={lane.status} className="stack gap-1">
              <p className="ac-lane-title">
                {lane.title} <span className="ac-count">{items.length}</span>
              </p>
              <p className="small">
                {items.length
                  ? items.map((s) => s.name).join(", ")
                  : lane.empty}
              </p>
            </div>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {latest?.summary ?? ""}
      </p>
    </details>
  );
}
