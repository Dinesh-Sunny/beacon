"use client";

// Agent activity, shown only while something is happening: a small pill at the top of the canvas
// with the agent at work or the last thing it did. It fades when the work stops. The full log
// opens on demand.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useCheck } from "@/lib/check-store";

// Plain words for the person; model names stay in the full log.
const PLAIN = {
  "Muse Spark agent": "reading",
  "Muse Voice Transcribe": "listening",
  "SAM 3.1": "finding",
  "Letter reader": "letter",
  "Call coach": "notes",
  "Muse Image": "painting",
} as const;

export function Activity() {
  const { log, busy } = useCheck();
  const t = useTranslations("activity");
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
            <b>
              {t(PLAIN[(working[0] ?? "") as keyof typeof PLAIN] ?? "working")}…
            </b>
          ) : last ? (
            last.kind === "model" || last.kind === "rules" ? (
              last.text
            ) : (
              t("checked")
            )
          ) : null}
        </span>
        <span className="activity-more">{open ? t("close") : t("steps")}</span>
      </button>
      {open && (
        <ol className="activity-log" aria-label={t("log")}>
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
