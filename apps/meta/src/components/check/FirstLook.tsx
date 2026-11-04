"use client";

// The canvas before the first answer: one line on what Beacon does, and a way to see it work.

import { SCHEMES } from "@/engine/rules";

export function FirstLook({ onExample }: { onExample: () => void }) {
  return (
    <section
      className="first-look"
      aria-labelledby="fl-h"
      data-testid="first-look"
    >
      <div className="lamp" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <h2 id="fl-h">
        {SCHEMES.length} kinds of help, checked against the official rules
      </h2>
      <p className="fl-lead">
        What may be yours shows here as you answer.{" "}
        <button type="button" className="linkbtn" onClick={onExample}>
          See an example
        </button>
      </p>
    </section>
  );
}
