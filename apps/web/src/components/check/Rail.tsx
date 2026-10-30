"use client";

import type { StepId } from "@beacon/rules";
import { useState } from "react";
import { type Draft, valueLabel } from "@/lib/answers";
import { PATH, type PathKey, type PathRow } from "@/lib/check-path";
import { Icon } from "../Icon";

interface Props {
  rows: PathRow[];
  draft: Draft;
  current: PathKey;
  onGo: (id: StepId) => void;
  onClear: () => void;
}

/** Value for one path row: the answers of its shown sub-steps, private ones said once. */
function rowValue(row: PathRow, draft: Draft): string {
  const steps = PATH.find((p) => p.key === row.key)?.steps ?? [];
  const values = steps
    .filter((id) => draft.progress[id])
    .map((id) => valueLabel(id, draft));
  return [...new Set(values.filter(Boolean))].join(", ");
}

function RailList({ rows, draft, current, onGo }: Omit<Props, "onClear">) {
  return (
    <ol className="stack m-0 list-none gap-0.5 p-0">
      {rows
        .filter((r) => r.key !== "review")
        .map((r) => {
          const isCur = r.key === current;
          const answered = r.status === "done" || r.status === "declined";
          const value = r.shown
            ? answered
              ? rowValue(r, draft)
              : ""
            : r.skipReason;
          const dotClass = !r.shown
            ? "skipped"
            : answered
              ? "done"
              : isCur
                ? "cur"
                : "todo";
          const mark =
            !r.shown || r.status === "declined" ? (
              "-"
            ) : answered ? (
              <Icon name="check" size={14} />
            ) : (
              r.number
            );
          const canGo = r.shown && answered && !isCur && r.first;
          return (
            <li key={r.key}>
              <button
                type="button"
                className="navrow"
                aria-current={isCur ? "step" : undefined}
                disabled={!canGo}
                onClick={() => r.first && onGo(r.first)}
                aria-label={
                  canGo ? `Change ${r.label}, now ${value}` : undefined
                }
              >
                <span className={`dot ${dotClass}`} aria-hidden="true">
                  {mark}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      isCur
                        ? "font-bold"
                        : r.shown && !answered
                          ? "text-ink-2"
                          : ""
                    }
                  >
                    {r.label}
                  </span>
                  {value && (
                    <span
                      className="text-[15px] text-ink-2"
                      data-testid={`rail-${r.key}`}
                    >
                      {value}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
    </ol>
  );
}

export function Rail(props: Props) {
  const [confirm, setConfirm] = useState(false);
  const shown = props.rows.filter((r) => r.shown && r.key !== "review");
  const answered = shown.filter(
    (r) => r.status === "done" || r.status === "declined",
  ).length;
  const clear = (
    <div className="px-1.5 pt-1.5">
      {!confirm ? (
        <button
          type="button"
          className="btn txt small"
          onClick={() => setConfirm(true)}
        >
          Clear my answers
        </button>
      ) : (
        <div role="status" className="stack gap-2 p-2">
          <p className="small font-bold">Clear all your answers?</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn sec !min-h-11 !px-4"
              onClick={() => {
                setConfirm(false);
                props.onClear();
              }}
            >
              Yes, clear them
            </button>
            <button
              type="button"
              className="btn txt"
              onClick={() => setConfirm(false)}
            >
              Keep them
            </button>
          </div>
        </div>
      )}
    </div>
  );
  return (
    <aside className="rail stack gap-4" aria-label="Your check">
      <section
        className="card !gap-1 !px-2.5 !py-4 max-lg:hidden"
        aria-labelledby="rail-title"
      >
        <h2 id="rail-title" className="cap px-2.5 pb-2">
          Your answers - {answered} of {shown.length}
        </h2>
        <RailList {...props} />
        {clear}
      </section>
      <details className="rail-sum card !py-3 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold">
          <Icon name="chevron-down" className="chev" />
          Your answers - {answered} of {shown.length} done
        </summary>
        <RailList {...props} />
        {clear}
      </details>
      <p className="small muted flex gap-2 px-3 max-lg:hidden">
        <Icon name="lock" size={18} className="mt-0.5 flex-none" />
        Private. Your answers stay in this browser tab. Nothing is saved unless
        you choose to.
      </p>
    </aside>
  );
}
