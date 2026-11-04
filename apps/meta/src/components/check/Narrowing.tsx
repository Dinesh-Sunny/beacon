"use client";

// Between the first answer and the first result: how much is still in play, and which areas
// the answers have already settled, so every answer visibly does something.

import { RANK, SCHEMES, TOPICS } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

export function Narrowing() {
  const { states } = useCheck();
  const open = SCHEMES.filter((s) => states[s.id]?.status === "open").length;
  const areas = TOPICS.map(([t, name]) => {
    const list = SCHEMES.filter((s) => s.topic === t);
    return {
      name,
      total: list.length,
      live: list.filter(
        (s) => (RANK[states[s.id]?.status ?? "open"] ?? 9) < RANK.out,
      ).length,
    };
  }).filter((a) => a.total);
  return (
    <section
      className="first-look narrowing"
      aria-live="polite"
      data-testid="narrowing"
    >
      <div className="lamp" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <h2>
        <b>{open}</b> kinds of help still in play
      </h2>
      <p className="fl-lead">
        Keep going. The first result lights up here as soon as one is likely.
      </p>
      <ul className="fl-chips quiet">
        {areas.map((a) => (
          <li key={a.name} className={a.live ? "" : "done"}>
            {a.name} <b>{a.live}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
