"use client";

// Agent activity, shown only while something is happening: a small pill at the top of the canvas
// with the agent at work or the last thing it did. It fades when the work stops. The full log
// opens on demand.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCheck } from "@/lib/check-store";

export function Activity() {
  const { log, busy } = useCheck();
  const [recent, setRecent] = useState(false);
  const [open, setOpen] = useState(false);
  const last = log.at(-1);
  const working = Object.entries(busy)
    .filter(([, on]) => on)
    .map(([name]) => name);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: show for a moment after each new step
  useEffect(() => {
    if (!log.length) return;
    setRecent(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRecent(false), 3500);
    return () => clearTimeout(timer.current);
  }, [log.length]);

  const visible = working.length > 0 || recent || open;
  if (!log.length && !working.length) return null;
  return (
    <div className={`activity${visible ? " on" : ""}`} data-testid="activity">
      <button type="button" className="activity-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`pulse${working.length ? " busy" : ""}`} aria-hidden="true" />
        <span className="activity-text">
          {working.length ? (
            <>
              <b>{working.join(", ")}</b> working
            </>
          ) : last ? (
            <>
              <b>{last.who}</b> {last.text}
            </>
          ) : null}
        </span>
        <Icon name={open ? "close" : "dots"} size={16} />
      </button>
      {open && (
        <ol className="activity-log" aria-label="Everything the agents did">
          {log.map((l) => (
            <li key={l.id} className={l.kind}>
              <span className="who">{l.who}</span>
              {l.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
