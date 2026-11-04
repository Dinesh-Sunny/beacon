import { LOOP } from "./content";

// The eight steps every person goes through. Solid amber = live today, dashed = where it's going.
// The legend only shows the "where it's going" half while some step is still to come.
export function StepsRail() {
  const coming = LOOP.some((s) => !s.live);
  return (
    <div className="mk-rail">
      <div className="mk-rail-groups" aria-hidden="true">
        <span className="live">Live today</span>
        {coming && <span>Where it's going</span>}
      </div>
      <ol>
        {LOOP.map((s, i) => (
          <li key={s.t} className={s.live ? "live" : ""}>
            <span className="mk-rail-dot">{i + 1}</span>
            <b>{s.t}</b>
            <span className="mk-rail-d">{s.d}</span>
            <span className="sr-only">
              {s.live ? "Live today." : "Coming next."}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
