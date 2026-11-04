// Where Beacon grows: rings spreading out from the lamp, then the plans and the promise.

const STAGES = [
  {
    t: "UK people and families",
    d: "Help for you and the people you look after.",
    now: true,
  },
  {
    t: "Businesses and organisations",
    d: "Support that a business or organisation can claim, found the same way.",
  },
  {
    t: "More countries",
    d: "The same eight steps, with each country's own rules.",
  },
  {
    t: "A worldwide network",
    d: "Providers refer people to each other through Beacon.",
  },
];

const PLANS = [
  {
    t: "Free check",
    when: "Today",
    d: "See what's likely yours, with warnings, the order to claim and what to say on the phone.",
  },
  {
    t: "Pro",
    when: "Planned",
    d: "Keeps watching after you claim: the decision, the first payment, changes to report and new rules.",
  },
  {
    t: "Funded Pro",
    when: "Planned",
    d: "Councils, housing associations and employers can pay for Pro for the people they serve.",
  },
];

export function Growth() {
  return (
    <div className="mk-grow">
      <div className="mk-rings" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s.t} className={`ring r${i}`} />
        ))}
        <span className="core" />
      </div>
      <ol className="mk-stages">
        {STAGES.map((s, i) => (
          <li key={s.t} className={s.now ? "now" : ""}>
            <span className="mk-stage-n">{s.now ? "Now" : `0${i + 1}`}</span>
            <div>
              <b>{s.t}</b>
              <span>{s.d}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Plans() {
  return (
    <div className="mk-plans-wrap">
      <ul className="mk-plans">
        {PLANS.map((p) => (
          <li key={p.t} className={p.when === "Today" ? "today" : ""}>
            <span className="mk-plan-when">{p.when}</span>
            <b>{p.t}</b>
            <span>{p.d}</span>
          </li>
        ))}
      </ul>
      <p className="mk-promise">
        Beacon will never take a cut of anything you're awarded.
      </p>
    </div>
  );
}
