import { SCHEMES } from "@/engine/rules";

// A slow, looping row of the real schemes Beacon checks. Text only, nothing to click.
export function SchemeMarquee() {
  const names = SCHEMES.map((s) => s.name);
  const half = Math.ceil(names.length / 2);
  const rows = [names.slice(0, half), names.slice(half)];
  return (
    <div className="mk-marquee">
      <ul className="sr-only">
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {rows.map((row, r) => (
        <div
          key={r}
          className={`mk-marquee-row${r ? " rev" : ""}`}
          aria-hidden="true"
        >
          <div className="mk-marquee-track">
            {[...row, ...row].map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={i >= row.length ? "dup" : undefined}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
