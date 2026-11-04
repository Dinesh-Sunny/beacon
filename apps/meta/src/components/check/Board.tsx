"use client";

// The support board: every stored scheme, grouped by life area, narrowing live as answers arrive.
// Tapping a scheme opens its sheet with each condition and how it stands right now.

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { byId, SCHEMES, type Status, TOPICS } from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";

const RANK: Record<Status, number> = { likely: 0, check: 1, unlock: 2, open: 3, out: 4 };

export function Board() {
  const { states, changed, select } = useCheck();
  return (
    <section className="board" aria-labelledby="board-h" data-testid="board">
      <div className="board-head">
        <h3 id="board-h">Everything Beacon is checking</h3>
        <div className="legend" aria-hidden="true">
          <span>
            <i style={{ border: "1.5px solid var(--line)" }} />
            Still open
          </span>
          <span>
            <i style={{ background: "var(--good)" }} />
            Likely
          </span>
          <span>
            <i style={{ background: "var(--check)" }} />
            Worth checking
          </span>
          <span>
            <i style={{ background: "var(--chain)" }} />
            Unlocks next
          </span>
        </div>
      </div>
      <div className="topics">
        {TOPICS.map(([t, name]) => {
          const list = SCHEMES.filter((s) => s.topic === t).sort(
            (a, b) => RANK[states[a.id]?.status ?? "open"] - RANK[states[b.id]?.status ?? "open"],
          );
          return (
            <div className="topic" key={t}>
              <h4>{name}</h4>
              <div className="cards">
                {list.map((s) => {
                  const st = states[s.id];
                  const status = st?.status ?? "open";
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`sc ${status}${changed.includes(s.id) ? " flash" : ""}`}
                      onClick={() => select(s.id)}
                      data-testid={`scheme-${s.id}`}
                      data-status={status}
                    >
                      <span className="nm">{s.name}</span>
                      <span className="chip">{STATUS_TXT[status]}</span>
                      {st?.reason && status !== "open" ? <span className="rs">{st.reason}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SchemeSheet() {
  const { selected, select, states } = useCheck();
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, select]);
  if (!selected) return null;
  const s = byId[selected];
  const st = states[selected];
  if (!s || !st) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes; Escape and the close button also do
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled on window
    <div className="sheet-back" onClick={() => select(null)}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop close */}
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-h"
        onClick={(e) => e.stopPropagation()}
        data-testid="sheet"
      >
        <div className="sheet-head">
          <div>
            <span className="eyebrow">{s.by}</span>
            <h2 id="sheet-h" style={{ fontSize: "1.6rem", marginTop: 4 }}>
              {s.name}
            </h2>
          </div>
          <button type="button" className="iconbtn" onClick={() => select(null)} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <p>{s.gives}</p>
        <div className={`sc ${st.status}`} style={{ cursor: "default" }}>
          <span className="nm">{STATUS_TXT[st.status]}</span>
          {st.reason ? <span className="rs">{st.reason}</span> : null}
        </div>
        <span className="eyebrow">How each condition stands</span>
        <ul className="rule">
          {s.rule.map((r, i) => {
            const m = st.marks[i];
            return (
              <li key={r.expr}>
                <span className={`m ${m === true ? "t" : m === false ? "f" : "u"}`} aria-hidden="true">
                  {m === true ? "✓" : m === false ? "–" : "?"}
                </span>
                <span>
                  {r.txt}
                  <span className="sr-only">{m === true ? " (met)" : m === false ? " (not met)" : " (not known yet)"}</span>
                  <code>{r.expr}</code>
                </span>
              </li>
            );
          })}
        </ul>
        {s.opens ? (
          <p className="hint">Once awarded, it also opens: {s.opens.map((o) => byId[o]?.name).join(", ")}.</p>
        ) : null}
        <p className="hint">{s.how}</p>
        <a className="btn ghost small" href={s.url} target="_blank" rel="noreferrer">
          Official page <Icon name="link" size={16} />
        </a>
      </div>
    </div>
  );
}
