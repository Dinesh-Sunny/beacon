"use client";

// Every kind of help Beacon checks, grouped by area of life. Each area is one row of dots that
// light up as answers settle them, so the canvas stays calm with hundreds of schemes. Open an
// area to see its tiles; tap a tile to see each condition and how it stands.

import { RANK, type Scheme, SCHEMES, type Status, TOPICS } from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";

const SHOWN: Status[] = ["likely", "check", "unlock"];
const COUNT_TXT: Partial<Record<Status, string>> = { likely: "likely", check: "worth checking", unlock: "unlock later" };

export function Constellation() {
  const { states, changed, select } = useCheck();
  const status = (s: Scheme): Status => states[s.id]?.status ?? "open";
  const areas = TOPICS.map(([t, name]) => {
    const list = SCHEMES.filter((s) => s.topic === t).sort((a, b) => RANK[status(a)] - RANK[status(b)]);
    return { t, name, list, best: Math.min(...list.map((s) => RANK[status(s)])) };
  })
    .filter((a) => a.list.length)
    .sort((a, b) => a.best - b.best);

  return (
    <section className="constellation" aria-labelledby="const-h" data-testid="board">
      <h3 id="const-h" className="eyebrow">
        Everything Beacon checks · {SCHEMES.length}
      </h3>
      <div className="areas">
        {areas.map((a) => {
          const counts = SHOWN.map((k) => [k, a.list.filter((s) => status(s) === k).length] as const).filter(([, n]) => n);
          return (
            <details key={a.t} className="area" data-testid={`area-${a.t}`}>
              <summary>
                <span className="area-name">{a.name}</span>
                <span className="dots" aria-hidden="true">
                  {a.list.map((s) => (
                    <i key={s.id} className={`${status(s)}${changed.includes(s.id) ? " flash" : ""}`} />
                  ))}
                </span>
                <span className="area-count">
                  {counts.length
                    ? counts.map(([k, n]) => `${n} ${COUNT_TXT[k]}`).join(" · ")
                    : a.list.some((s) => status(s) === "open")
                      ? `${a.list.filter((s) => status(s) === "open").length} to check`
                      : "None fit yet"}
                </span>
              </summary>
              <div className="tiles">
                {a.list.map((s) => {
                  const st = status(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`tile ${st}${changed.includes(s.id) ? " flash" : ""}`}
                      onClick={() => select(s.id)}
                      data-testid={`scheme-${s.id}`}
                      data-status={st}
                      title={`${s.name}: ${STATUS_TXT[st]}`}
                    >
                      <i aria-hidden="true" />
                      {s.name}
                      <span className="sr-only">: {STATUS_TXT[st]}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
