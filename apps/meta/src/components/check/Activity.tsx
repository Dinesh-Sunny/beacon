"use client";

// Agent activity, shown only while something is happening: a small pill at the top of the canvas
// with the agent at work or the last thing it did. It fades when the work stops. The full log
// opens on demand.

import { useEffect, useRef, useState } from "react";
import { useCheck } from "@/lib/check-store";

// Plain words for the person; model names stay in the full log.
const PLAIN: Record<string, string> = {
  "Muse Spark agent": "Reading what you said",
  "Muse Voice Transcribe": "Listening back",
  "SAM 3.1": "Finding the letter",
  "Letter reader": "Reading your letter",
  "Call coach": "Writing your call notes",
  "Muse Image": "Painting your picture",
};

export function Activity() {
  const { log, busy } = useCheck();
  const [recent, setRecent] = useState(false);
  const [open, setOpen] = useState(false);
  const last = log.at(-1);
  const working = Object.entries(busy)
    .filter(([, on]) => on)
    .map(([name]) => name);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Show for a moment after each new step.
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
      <button
        type="button"
        className="activity-pill"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className={`pulse${working.length ? " busy" : ""}`}
          aria-hidden="true"
        />
        <span className="activity-text">
          {working.length ? (
            <b>{PLAIN[working[0] ?? ""] ?? "Working on it"}…</b>
          ) : last ? (
            last.kind === "model" || last.kind === "rules" ? (
              last.text
            ) : (
              "Checked the rules again"
            )
          ) : null}
        </span>
        <span className="activity-more">{open ? "Close" : "Steps"}</span>
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
