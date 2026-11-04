import { Icon } from "@/components/Icon";

type Lane = { lane: string; icon: string; items: { t: string; d: string }[] };

// Four lanes joined by a track with a light that travels along it (CSS only).
export function Pipeline({ lanes }: { lanes: Lane[] }) {
  return (
    <div className="mk-pipe">
      <div className="mk-pipe-track" aria-hidden="true">
        <span className="mk-pipe-light" />
      </div>
      <ol>
        {lanes.map((l, i) => (
          <li key={l.lane} className={`mk-lane l${i}`}>
            <div className="mk-lane-head">
              <span className="mk-lane-icon">
                <Icon name={l.icon} size={20} />
              </span>
              <b>{l.lane}</b>
            </div>
            <ul>
              {l.items.map((it) => (
                <li key={it.t}>
                  <b>{it.t}</b>
                  <span>{it.d}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
