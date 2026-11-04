// The Beacon Framework diagram: people who need help on the left, everyone who gives help on the
// right, the Beacon lamp in the middle. Beams light one connection at a time (pure CSS, no JS).
// Below 760px a stacked version replaces the wide SVG so labels stay readable.

const PEOPLE = [
  "Older people",
  "Disabled people",
  "Carers",
  "Families",
  "Young people",
  "Out of work",
  "On a low wage",
  "Bereavement and life events",
  "Checking for someone else",
];
const GIVERS = ["UK government", "Councils", "NHS", "Charities", "Utility companies", "Employers", "Unclaimed money and redress"];
// Which provider each person's beam lights (illustrative pairs).
const PAIR = [0, 1, 3, 2, 5, 0, 4, 6, 1];

const W = 1080;
const PW = 272;
const PH = 42;
const CX = W / 2;
const CY = 300;
const py = (i: number) => 30 + i * 62;
const gy = (j: number) => 76 + j * 72;
const SLOT = 1.6; // seconds per beam
const delay = (i: number) => ({ animationDelay: `${i * SLOT}s` });

export function BeaconMap() {
  return (
    <figure className="mk-map" style={{ ["--cycle" as string]: `${PEOPLE.length * SLOT}s` }}>
      <svg className="mk-map-wide" viewBox={`0 0 ${W} 600`} role="img" aria-label="People who need help on the left, everyone who gives help on the right, and Beacon in the middle connecting them.">
        <defs>
          <radialGradient id="mk-lamp-glow">
            <stop offset="0" stopColor="#f5a524" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
          </radialGradient>
        </defs>
        <text x={10} y={14} className="mk-map-head">
          People who need help
        </text>
        <text x={W - 10} y={14} textAnchor="end" className="mk-map-head">
          Everyone who gives help
        </text>
        <g className="mk-map-lines">
          {PEOPLE.map((_, i) => (
            <path key={`l${i}`} d={`M${10 + PW},${py(i) + PH / 2} C${400},${py(i) + PH / 2} ${420},${CY} ${CX - 52},${CY}`} />
          ))}
          {GIVERS.map((_, j) => (
            <path key={`r${j}`} d={`M${CX + 52},${CY} C${660},${CY} ${680},${gy(j) + PH / 2} ${W - 10 - PW},${gy(j) + PH / 2}`} />
          ))}
        </g>
        <g className="mk-map-beams">
          {PEOPLE.map((_, i) => (
            <g key={`b${i}`}>
              <path pathLength={1} style={delay(i)} d={`M${10 + PW},${py(i) + PH / 2} C${400},${py(i) + PH / 2} ${420},${CY} ${CX - 52},${CY}`} />
              <path
                pathLength={1}
                style={delay(i)}
                className="out"
                d={`M${CX + 52},${CY} C${660},${CY} ${680},${gy(PAIR[i]) + PH / 2} ${W - 10 - PW},${gy(PAIR[i]) + PH / 2}`}
              />
            </g>
          ))}
        </g>
        {PEOPLE.map((p, i) => (
          <g key={p} className="mk-map-pill">
            <rect x={10} y={py(i)} width={PW} height={PH} rx={PH / 2} />
            <rect x={10} y={py(i)} width={PW} height={PH} rx={PH / 2} className="lit" style={delay(i)} />
            <text x={30} y={py(i) + PH / 2 + 6}>
              {p}
            </text>
          </g>
        ))}
        {GIVERS.map((g, j) => (
          <g key={g} className="mk-map-pill giver">
            <rect x={W - 10 - PW} y={gy(j)} width={PW} height={PH} rx={PH / 2} />
            {PAIR.map((pj, i) =>
              pj === j ? <rect key={i} x={W - 10 - PW} y={gy(j)} width={PW} height={PH} rx={PH / 2} className="lit" style={delay(i)} /> : null,
            )}
            <text x={W - 30} y={gy(j) + PH / 2 + 6} textAnchor="end">
              {g}
            </text>
          </g>
        ))}
        <g className="mk-map-lamp">
          <circle cx={CX} cy={CY} r={130} fill="url(#mk-lamp-glow)" className="halo" />
          <circle cx={CX} cy={CY} r={52} className="disc" />
          <g transform={`translate(${CX - 22},${CY - 30})`}>
            <circle cx="22" cy="22" r="9" fill="#F5A524" />
            <path d="M22 4v5M22 35v5M4 22h5M35 22h5M9.3 9.3l3.5 3.5M31.2 31.2l3.5 3.5M34.7 9.3l-3.5 3.5M12.8 31.2l-3.5 3.5" stroke="#F5A524" strokeWidth="3" strokeLinecap="round" />
          </g>
          <text x={CX} y={CY + 84} textAnchor="middle" className="mk-map-name">
            Beacon
          </text>
          <text x={CX} y={CY + 106} textAnchor="middle" className="mk-map-sub">
            agents connect the two
          </text>
        </g>
      </svg>

      <div className="mk-map-stack" aria-hidden="true">
        <span className="mk-map-label">People who need help</span>
        <ul>
          {PEOPLE.map((p, i) => (
            <li key={p} style={delay(i)}>
              {p}
            </li>
          ))}
        </ul>
        <div className="mk-map-mid">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="58" fill="url(#mk-lamp-glow-s)" className="halo" />
            <defs>
              <radialGradient id="mk-lamp-glow-s">
                <stop offset="0" stopColor="#f5a524" stopOpacity="0.55" />
                <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="26" className="disc" />
            <circle cx="60" cy="60" r="8" fill="#F5A524" />
            <path d="M60 42v5M60 73v5M42 60h5M73 60h5" stroke="#F5A524" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <b>Beacon</b>
          <span>agents connect the two</span>
        </div>
        <span className="mk-map-label">Everyone who gives help</span>
        <ul className="givers">
          {GIVERS.map((g, j) => (
            <li key={g} style={delay(PAIR.indexOf(j))}>
              {g}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
