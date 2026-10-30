import type { PathKey, PathRow } from "@/lib/check-path";

/** One dot per step this person is asked; skipped steps are not counted (Kit 11/Beacon path). */
export function BeaconPath({
  rows,
  current,
}: {
  rows: PathRow[];
  current: PathKey;
}) {
  const shown = rows.filter((r) => r.shown);
  const at = shown.findIndex((r) => r.key === current);
  const n = at + 1;
  const total = shown.length;
  const section = shown[at]?.label ?? "";
  const text = `Step ${n} of ${total} - ${section}`;
  return (
    <div className="bpath">
      <ol
        role="progressbar"
        aria-valuenow={n}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuetext={text}
        aria-label="Your progress"
      >
        {shown.map((r, i) => (
          <li key={r.key} className={i < at ? "done" : i === at ? "cur" : ""} />
        ))}
      </ol>
      <p className="small muted" data-testid="path-label">
        {text}
      </p>
    </div>
  );
}
