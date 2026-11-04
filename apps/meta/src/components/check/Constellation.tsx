"use client";

// Every kind of help Beacon checks, as small tiles that start faint and light up as answers
// settle them. Tap one to see each condition and how it stands.

import { RANK, SCHEMES, TOPICS } from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";


export function Constellation() {
  const { states, changed, select } = useCheck();
  return (
    <section className="constellation" aria-labelledby="const-h" data-testid="board">
      <h3 id="const-h" className="eyebrow">
        Everything Beacon checks
      </h3>
      <div className="tiles">
        {TOPICS.flatMap(([t]) => SCHEMES.filter((s) => s.topic === t))
          .sort((a, b) => RANK[states[a.id]?.status ?? "open"] - RANK[states[b.id]?.status ?? "open"])
          .map((s) => {
            const status = states[s.id]?.status ?? "open";
            return (
              <button
                key={s.id}
                type="button"
                className={`tile ${status}${changed.includes(s.id) ? " flash" : ""}`}
                onClick={() => select(s.id)}
                data-testid={`scheme-${s.id}`}
                data-status={status}
                title={`${s.name}: ${STATUS_TXT[status]}`}
              >
                <i aria-hidden="true" />
                {s.name}
                <span className="sr-only">: {STATUS_TXT[status]}</span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
