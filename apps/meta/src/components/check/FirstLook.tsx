"use client";

// The canvas before the first answer: what Beacon is about to do, in real numbers from the rule
// packs. How many kinds of help it checks, who gives them, how many questions most people answer
// (worked out by running the planner on the examples), and what happens to the answers.

import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { providerCounts, questionsToFinish, SCHEMES } from "@/engine/rules";
import { EXAMPLES } from "@/lib/examples";

export function FirstLook({ onExample }: { onExample: () => void }) {
  const questions = useMemo(() => {
    const n = EXAMPLES.map((e) => questionsToFinish(e.answers));
    return { min: Math.min(...n), max: Math.max(...n) };
  }, []);
  const providers = providerCounts();

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
        Beacon checks {SCHEMES.length} kinds of help against the official rules
      </h2>
      <p className="fl-lead">
        {questions.min === questions.max
          ? `About ${questions.min}`
          : `${questions.min} to ${questions.max}`}{" "}
        short questions, each asked only if it can still change a result. What
        looks likely lights up here as you go.
      </p>

      <div className="fl-block">
        <span className="eyebrow">Who it checks</span>
        <ul className="fl-chips">
          {providers.map(([p, n]) => (
            <li key={p}>
              {p} <b>{n}</b>
            </li>
          ))}
        </ul>
      </div>

      <p className="hint fl-who">
        Checking for Mum, or someone you help? Say so in the chat, and Beacon
        asks about them instead.
      </p>

      <ul className="fl-promises">
        <li>
          <Icon name="shield" size={16} /> Answers stay on this device
        </li>
        <li>
          <Icon name="lock" size={16} /> No name, NI number or bank details
        </li>
        <li>
          <Icon name="link" size={16} /> Every result links to its official page
        </li>
        <li>
          <Icon name="check" size={16} /> Free, and nothing is claimed without
          you
        </li>
      </ul>

      <button
        type="button"
        className="btn ghost small fl-example"
        onClick={onExample}
      >
        <Icon name="play" size={16} /> Not ready? Watch an example check
      </button>
    </section>
  );
}
