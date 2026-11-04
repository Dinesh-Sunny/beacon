// Beams of light behind the hero, after Raycast's hero: diagonal bars of beacon amber with a fine
// film grain, sweeping in once on load and fading as the page scrolls. Pure CSS; decorative only,
// and still for reduced motion or the Calmer setting.

const BEAMS = [
  { x: 6, w: 120, d: 0 },
  { x: 20, w: 190, d: 0.12 },
  { x: 37, w: 90, d: 0.24 },
  { x: 49, w: 230, d: 0.08 },
  { x: 66, w: 70, d: 0.3 },
  { x: 76, w: 150, d: 0.18 },
  { x: 90, w: 60, d: 0.36 },
];

export function HeroBeams() {
  return (
    <div className="hb" aria-hidden="true">
      <div className="hb-rot">
        {BEAMS.map((b) => (
          <i
            key={b.x}
            style={{
              left: `${b.x}%`,
              width: b.w,
              animationDelay: `${b.d}s, ${1.8 + b.d * 4}s`,
            }}
          />
        ))}
      </div>
      <div className="hb-grain" />
    </div>
  );
}
