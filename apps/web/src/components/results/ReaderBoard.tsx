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

// The reading step as a live board: Beam readers (one per open kind of support, up to five at once)
// sit on the card they are reading, and each card moves to its verdict lane when its finding is settled.

export type RowStatus = "waiting" | "reading" | "done" | "failed";

export interface ReadEntry {
  id: number;
  who: "beam" | "checker" | "rules";
  text: string;
  source?: { label: string; url: string };
}

const WHO = {
  beam: "Beam reader",
  checker: "Quote checker",
  rules: "Rules agent",
} as const;

type LaneKey = "reading" | "likely" | "worth-checking" | "settled";
const LANES: { key: LaneKey; title: string }[] = [
  { key: "reading", title: "Reading" },
  { key: "likely", title: "Likely" },
  { key: "worth-checking", title: "Worth checking" },
  { key: "settled", title: "Not now or already yours" },
];

const laneOf = (f: Finding | undefined): LaneKey =>
  !f
    ? "reading"
    : f.verdict === "likely" || f.verdict === "worth-checking"
      ? f.verdict
      : "settled";

export function ReaderBoard({
  plan,
  rows,
  findings,
  feed,
}: {
  plan: SchemeId[];
  rows: Partial<Record<SchemeId, RowStatus>>;
  findings: Finding[];
  feed: ReadEntry[];
}) {
  const byScheme = new Map(findings.map((f) => [f.scheme, f]));
  const inView = SCHEMES.filter(
    (s) => plan.includes(s.id) || byScheme.has(s.id),
  );
  const board = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<SchemeId, HTMLElement>());
  const key = inView.map((s) => `${s.id}:${laneOf(byScheme.get(s.id))}`).join();
  const rects = useFlip(cards, key);

  // A reader cursor on every card being read right now.
  const reading = inView
    .filter((s) => rows[s.id] === "reading" && !byScheme.has(s.id))
    .map((s) => s.id);
  const [spots, setSpots] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the cards after each move
  useLayoutEffect(() => {
    const host = board.current?.getBoundingClientRect();
    if (!host) return;
    const next: Record<string, { x: number; y: number }> = {};
    for (const id of reading) {
      const r =
        rects.current.get(id) ?? cards.current.get(id)?.getBoundingClientRect();
      if (r)
        next[id] = {
          x: r.left - host.left + r.width * 0.62,
          y: r.top - host.top + r.height * 0.5,
        };
    }
    setSpots(next);
  }, [key, reading.join()]);

  return (
    <section
      className="agent-canvas !static !max-h-none"
      aria-labelledby="rb-title"
    >
      <header className="ac-head">
        <div className="flex items-center gap-2">
          <span className="ac-live" aria-hidden="true" />
          <h2 id="rb-title" className="t-title">
            Beacon at work
          </h2>
        </div>
        <p className="small muted">
          {reading.length
            ? `${reading.length} Beam reader${reading.length === 1 ? " is" : "s are"} reading GOV.UK pages now.`
            : "Each card moves when its rule line has been checked."}
        </p>
      </header>

      <div className="ac-board ac-board-4" ref={board}>
        {LANES.map((lane) => {
          const items = inView.filter(
            (s) => laneOf(byScheme.get(s.id)) === lane.key,
          );
          return (
            <section
              key={lane.key}
              className={`ac-lane rl-${lane.key}`}
              aria-label={`${lane.title}: ${items.length}`}
            >
              <h3 className="ac-lane-title">
                {lane.title}
                <span className="ac-count">{items.length}</span>
              </h3>
              <ul className="ac-cards">
                {items.map((s) => {
                  const f = byScheme.get(s.id);
                  const st = rows[s.id] ?? "waiting";
                  return (
                    <li
                      key={s.id}
                      ref={(el) => {
                        if (el) cards.current.set(s.id, el);
                        else cards.current.delete(s.id);
                      }}
                      className={`ac-card ${!f && st === "reading" ? "is-reading" : ""}`}
                    >
                      <span className="ac-card-name">{s.name}</span>
                      <span className="ac-card-meta">
                        {f
                          ? f.quoteVerified
                            ? "Rule line checked word for word"
                            : VERDICT_LABEL[f.verdict]
                          : st === "reading"
                            ? `Reading gov.uk${s.govukPaths[0]}`
                            : st === "done"
                              ? "Read. Judging the rule"
                              : st === "failed"
                                ? "Page didn't open"
                                : "Waiting for a reader"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {reading.map((id, i) =>
          spots[id] ? (
            <span
              key={id}
              aria-hidden="true"
              className="ac-cursor ag-beam is-shown"
              style={{
                transform: `translate(${spots[id].x}px, ${spots[id].y}px)`,
              }}
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
              <span className="ac-cursor-label">Beam reader {i + 1}</span>
            </span>
          ) : null,
        )}
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
