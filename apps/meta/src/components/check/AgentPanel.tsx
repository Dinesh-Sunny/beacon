"use client";

// What the agents did: a live feed so the person sees work happening as they answer.
// Code agents run on every answer; Muse agents show only when they're called.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { type LogKind, useCheck } from "@/lib/check-store";

const DOT: Record<LogKind, string> = {
  you: "check",
  derive: "spark",
  rules: "shield",
  planner: "arrow",
  model: "spark",
};

export function AgentPanel() {
  const { log, busy } = useCheck();
  const [all, setAll] = useState(false);
  const shown = all ? log : log.slice(-4);
  const end = useRef<HTMLLIElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keep the newest entry in view when expanded
  useEffect(() => {
    if (all) end.current?.scrollIntoView({ block: "nearest" });
  }, [log.length, all]);
  const roster = ["Question planner", "Fact deriver", "Rules engine", "Chain finder", ...Object.keys(busy)];
  const seen = new Set(log.map((l) => l.who));
  return (
    <aside className="panel" aria-labelledby="agents-h" data-testid="agents">
      <div className="panel-head">
        <h3 id="agents-h">Agents at work</h3>
        {log.length > 4 && (
          <button type="button" className="linkbtn" onClick={() => setAll((a) => !a)} aria-expanded={all}>
            {all ? "Show less" : `See all ${log.length} steps`}
          </button>
        )}
      </div>
      <div className="agents">
        {[...new Set(roster)].map((a) => (
          <span key={a} className={`agent${busy[a] ? " busy" : seen.has(a) ? " done" : ""}`}>
            <i />
            {a}
          </span>
        ))}
      </div>
      <ol className="log" aria-live="polite">
        {log.length === 0 ? (
          <li>
            <span className="dot">
              <Icon name="arrow" size={13} />
            </span>
            <span>
              <span className="who">Question planner</span>
              Picked the first question. It settles the most schemes at once.
            </span>
          </li>
        ) : (
          shown.map((l) => (
            <li key={l.id} className={l.kind}>
              <span className="dot">
                <Icon name={DOT[l.kind]} size={13} />
              </span>
              <span>
                <span className="who">{l.who}</span>
                {l.text}
              </span>
            </li>
          ))
        )}
        <li ref={end} aria-hidden="true" style={{ display: "block", height: 0 }} />
      </ol>
    </aside>
  );
}
