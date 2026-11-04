// The hero's sky at first light: a cool morning sky warming towards the horizon, a bank of cloud
// that rises towards the right, and the beacon coming up over it beside the headline. One idea,
// drawn once in SVG: help that is already there, coming into view. Decorative only; the sun rises
// once on load (CSS) and stays still for reduced motion or the Calmer setting.

const W = 1600;
const H = 900;

/** A ridge of cloud: puffs along a line that climbs from yLeft to yRight, closed to the bottom. */
function ridge(yLeft: number, yRight: number, radii: number[], start: number) {
  const at = (x: number) => yLeft + ((yRight - yLeft) * x) / W;
  let x = start;
  let d = `M${start},${H} L${start},${at(start)}`;
  let i = 0;
  while (x < W + 120) {
    const r = radii[i % radii.length] as number;
    const nx = x + r * 1.7;
    // Puffs a little wider than a half-circle step read as one soft mass.
    d += ` A${r},${r} 0 0 1 ${nx},${at(nx)}`;
    x = nx;
    i++;
  }
  return `${d} L${x},${H} Z`;
}

const BACK = ridge(700, 330, [70, 46, 96, 58, 84, 40, 110, 62], -40);
const MID = ridge(780, 470, [52, 88, 38, 70, 100, 48, 76, 58], -90);
const FRONT = ridge(860, 640, [44, 74, 58, 92, 40, 66, 82, 52], -20);

export function HeroSky() {
  return (
    <div className="hs-sky" aria-hidden="true">
      <svg
        className="hs-bank"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMaxYMax slice"
      >
        <defs>
          <radialGradient id="hs-halo">
            <stop offset="0" stopColor="var(--hs-sun)" stopOpacity="0.5" />
            <stop offset="0.4" stopColor="var(--hs-sun)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--hs-sun)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="hs-sun">
          <circle cx="1240" cy="300" r="380" fill="url(#hs-halo)" />
          <circle cx="1240" cy="300" r="92" fill="var(--hs-sun)" />
        </g>
        <path d={BACK} fill="var(--hs-cloud-back)" />
        <path d={MID} fill="var(--hs-cloud-mid)" />
        <path d={FRONT} fill="var(--hs-cloud-front)" />
      </svg>
    </div>
  );
}
