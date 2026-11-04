"use client";

// The canvas before the first answer. Names real help people know, says how much more is checked,
// and points at what's different: each result comes with the official rule behind it.

import { byId, SCHEMES } from "@/engine/rules";

const NAMED = ["pc", "ctr"];

export function FirstLook({ onExample }: { onExample: () => void }) {
  const names = NAMED.map((id) => byId[id]?.name).filter(Boolean);
  return (
    <section
      className="first-look"
      aria-labelledby="fl-h"
      data-testid="first-look"
    >
      {/* The Beacon Framework in one line: you on one side, everyone who gives help on the other. */}
      <div
        className="fl-map"
        role="img"
        aria-label="You on one side, everyone who gives help on the other, and Beacon connecting the two."
      >
        <span className="fl-end">You, or someone you look after</span>
        <i className="fl-beam" />
        <div className="lamp" aria-hidden="true">
          <i />
          <i />
          <i />
          <span />
        </div>
        <i className="fl-beam out" />
        <span className="fl-end">Government, councils, NHS, charities</span>
      </div>
      <h2 id="fl-h">
        {names.join(", ")}, and {SCHEMES.length - names.length} more
      </h2>
      <p className="fl-lead">
        As you answer, what may be yours shows up here with the official rule
        behind it.{" "}
        <button type="button" className="linkbtn" onClick={onExample}>
          See an example
        </button>
      </p>
    </section>
  );
}
