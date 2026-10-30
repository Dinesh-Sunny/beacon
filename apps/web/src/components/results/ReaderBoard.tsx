"use client";

import {
  type Finding,
  SCHEMES,
  type SchemeId,
  VERDICT_LABEL,
} from "@beacon/rules";
import { useLayoutEffect, useRef, useState } from "react";
import { useFlip } from "../check/use-flip";
import { Icon } from "../Icon";

// The reading step as a live board. A page is fetched first ("Fetching"), then a Beam reader holds it
// while the model judges it; each reader keeps its number until its finding is settled, and the card
// moves to its verdict lane with the checked quote and the tokens Beam used on it.

export type RowStatus = "waiting" | "reading" | "done" | "failed" | "stopped";

export interface ReadEntry {
  id: number;
  who: "beam" | "checker" | "rules" | "beacon";
  text: string;
  source?: { label: string; url: string };
}

const WHO = {
  beam: "Beam reader",
  checker: "Quote checker",
  rules: "Rules agent",
  beacon: "Beacon",
} as const;

type LaneKey =
  | "reading"
  | "likely"
  | "worth-checking"
  | "already-get"
  | "unlikely-right-now";
const LANES: { key: LaneKey; title: string; empty: string }[] = [
  { key: "reading", title: "Reading", empty: "All pages read" },
  { key: "likely", title: "Likely", empty: "Likely results land here" },
  {
    key: "worth-checking",
    title: "Worth checking",
    empty: "Results to look into land here",
  },
  { key: "already-get", title: "You get this", empty: "Nothing here yet" },
  {
    key: "unlikely-right-now",
    title: "Unlikely right now",
    empty: "Nothing here yet",
  },
];

const laneOf = (f: Finding | undefined): LaneKey => (f ? f.verdict : "reading");

const READERS = 5;

export function ReaderBoard({
  plan,
  rows,
  findings,
  feed,
  tokens,
  judged,
  effort,
  live,
}: {
  plan: SchemeId[];
  rows: Partial<Record<SchemeId, RowStatus>>;
  findings: Finding[];
  feed: ReadEntry[];
  /** Model tokens per kind of support, from the usage events */
  tokens: Partial<Record<SchemeId, number>>;
  /** Findings that came from Beam's reading (not from the rules in code or a page failure) */
  judged: number;
  /** Reasoning effort Beam used to judge, from the usage events */
  effort?: string;
  /** False once reading has finished or stopped */
  live: boolean;
}) {
  const byScheme = new Map(findings.map((f) => [f.scheme, f]));
  const inView = SCHEMES.filter(
    (s) => plan.includes(s.id) || byScheme.has(s.id),
  );
  const board = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<SchemeId, HTMLElement>());
  const key = inView.map((s) => `${s.id}:${laneOf(byScheme.get(s.id))}`).join();
  const rects = useFlip(cards, key);

  // Beam holds a page once it is fetched ("done") until its finding is settled.
  const judging = live
    ? inView
        .filter((s) => rows[s.id] === "done" && !byScheme.has(s.id))
        .map((s) => s.id)
    : [];
  // Each reader keeps its number for the whole read, from a pool of five.
  const numbers = useRef(new Map<SchemeId, number>());
  for (const id of [...numbers.current.keys()])
    if (!judging.includes(id)) numbers.current.delete(id);
  for (const id of judging)
    if (!numbers.current.has(id)) {
      const taken = new Set(numbers.current.values());
      const free = Array.from({ length: READERS }, (_, i) => i + 1).find(
        (n) => !taken.has(n),
      );
      numbers.current.set(id, free ?? numbers.current.size + 1);
    }

  const [spots, setSpots] = useState<
    Record<string, { x: number; y: number; flip: boolean }>
  >({});
  const judgingKey = judging.join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the cards after each move
  useLayoutEffect(() => {
    const host = board.current?.getBoundingClientRect();
    if (!host) return;
    const next: Record<string, { x: number; y: number; flip: boolean }> = {};
    for (const id of judging) {
      const r =
        rects.current.get(id) ?? cards.current.get(id)?.getBoundingClientRect();
      if (!r) continue;
      const x = r.right - host.left - 14;
      // The label hangs inside the reader's own card so it never covers a neighbour.
      next[id] = { x, y: r.bottom - host.top - 6, flip: true };
    }
    setSpots(next);
  }, [key, judgingKey]);

  const totalTokens = Object.values(tokens).reduce((a, b) => a + (b ?? 0), 0);
  const read = judged;
  const stopped = Object.values(rows).includes("stopped");

  return (
    <section
      className="agent-canvas reader-board !static !max-h-none"
      aria-labelledby="rb-title"
    >
      <header className="ac-head">
        <div className="flex items-center gap-2">
          {live && <span className="ac-live" aria-hidden="true" />}
          <h2 id="rb-title" className="t-title">
            Beacon at work
          </h2>
        </div>
        <p className="small muted">
          {judging.length
            ? `${judging.length} Beam reader${judging.length === 1 ? " is" : "s are"} reading GOV.UK pages against your answers.`
            : stopped
              ? "Reading stopped. The cards say what was read."
              : live
                ? "Fetching the official pages."
                : "Each card shows where its result came from."}
        </p>
        {totalTokens > 0 && (
          <p className="ac-meter">
            Beam judged {read} page{read === 1 ? "" : "s"} ·{" "}
            {totalTokens.toLocaleString("en-GB")} tokens
            {effort ? ` · judged at ${effort} effort` : ""}
          </p>
        )}
      </header>

      <div className="ac-board ac-board-4" ref={board}>
        {LANES.map((lane) => {
          const items = inView.filter(
            (s) => laneOf(byScheme.get(s.id)) === lane.key,
          );
          const title =
            lane.key === "reading" && stopped ? "Not read" : lane.title;
          return (
            <section
              key={lane.key}
              className={`ac-lane rl-${lane.key}`}
              aria-label={`${title}: ${items.length}`}
            >
              <h3 className="ac-lane-title">
                {title}
                <span className="ac-count">{items.length}</span>
              </h3>
              <ul className="ac-cards">
                {items.map((s) => {
                  const f = byScheme.get(s.id);
                  const st = rows[s.id] ?? "waiting";
                  const t = tokens[s.id];
                  return (
                    <li
                      key={s.id}
                      ref={(el) => {
                        if (el) cards.current.set(s.id, el);
                        else cards.current.delete(s.id);
                      }}
                      className={`ac-card ${judging.includes(s.id) ? "is-reading" : ""}`}
                    >
                      <span className="ac-card-name">{s.name}</span>
                      {f?.verdict === "likely" && f.quoteVerified && (
                        <q className="ac-quote">{f.quote}</q>
                      )}
                      <span className="ac-card-meta">
                        {f
                          ? f.quoteVerified
                            ? `${VERDICT_LABEL[f.verdict]} · rule line checked word for word`
                            : VERDICT_LABEL[f.verdict]
                          : st === "reading"
                            ? "Fetching the page"
                            : st === "done"
                              ? "Beam is reading it"
                              : st === "failed"
                                ? "Page didn't open"
                                : st === "stopped"
                                  ? "Not read - stopped"
                                  : "Waiting for a reader"}
                      </span>
                      {t ? (
                        <span className="ac-card-tokens">
                          {t.toLocaleString("en-GB")} tokens
                        </span>
                      ) : null}
                    </li>
                  );
                })}
                {items.length === 0 && (
                  <li className="ac-empty">{lane.empty}</li>
                )}
              </ul>
            </section>
          );
        })}
        {judging.map((id) => {
          const p = spots[id];
          if (!p) return null;
          return (
            <span
              key={id}
              aria-hidden="true"
              className={`ac-cursor ag-beam is-shown ${p.flip ? "is-flip" : ""}`}
              style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden="true"
              >
                <title>Reader cursor</title>
                <path d="M2 1l13 7-6 1.5L6.5 16z" />
              </svg>
              <span className="ac-cursor-label">
                Beam reader {numbers.current.get(id)}
              </span>
            </span>
          );
        })}
      </div>

      <section className="ac-feed" aria-labelledby="rb-feed">
        <h3 id="rb-feed" className="ac-lane-title">
          What the agents did
        </h3>
        <ol className="ac-feed-list">
          {feed.map((e) => (
            <li key={e.id} className="ac-item">
              <span className={`ac-dot ag-${e.who}`} aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-1">
                <span>
                  <strong>{WHO[e.who]}.</strong> {e.text}
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
      </section>
    </section>
  );
}
