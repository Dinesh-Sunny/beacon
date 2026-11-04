"use client";

// One quiet line under each claim: what you've done so far. It appears as a single link and
// grows only when used: applied shows what to expect, refused shows how to challenge, and an
// award of a gateway benefit opens the help that was waiting on it.

import { Icon } from "@/components/Icon";
import { theyify } from "@/engine/facts";
import {
  BENEFIT_OF,
  byId,
  challengeFor,
  evaluate,
  keepFor,
} from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { type ClaimState, useClaims } from "@/lib/claims";

const LABEL: Record<ClaimState, string> = {
  applied: "Applied",
  awarded: "Awarded",
  refused: "Refused",
};

export function ClaimTrack({ id }: { id: string }) {
  const { claims, setClaim, setFresh } = useClaims();
  const { answers, apply, subject, announce } = useCheck();
  const s = byId[id];
  if (!s) return null;
  const claim = claims[id];
  const challenge = challengeFor(s);
  const keep = keepFor(s);

  const mark = (state: ClaimState | null) => {
    setClaim(id, state);
    const b = BENEFIT_OF[id];
    if (state === "awarded" && b) {
      const have = Array.isArray(answers.benefits) ? answers.benefits : [];
      if (have.includes(b as never)) return;
      const next = { ...answers, benefits: [...have, b] as typeof have };
      // Name what the award opened, and mark it New, so success is visible where it happened.
      const before = evaluate(answers);
      const after = evaluate(next);
      const opened = Object.keys(after).filter(
        (k) =>
          after[k]?.status === "likely" &&
          before[k]?.status !== "likely" &&
          k !== id,
      );
      setFresh(opened);
      apply({ benefits: next.benefits }, "form");
      announce(
        opened.length
          ? `${s.name} awarded. It opened ${opened.length} more: ${opened.map((k) => byId[k]?.name).join(", ")}.`
          : `${s.name} awarded.`,
      );
    }
  };

  if (!claim)
    return (
      <div className="track">
        <button
          type="button"
          className="btn ghost small track-start"
          onClick={() => mark(s.act ? "awarded" : "applied")}
          data-testid={`track-${id}`}
        >
          <Icon name="check" size={16} />{" "}
          {s.act
            ? "Mark as done"
            : subject.who === "me"
              ? "I've applied"
              : "They've applied"}
        </button>
      </div>
    );

  // Things you join or ask for (a register, advice) are simply done; claims have a decision.
  if (s.act)
    return (
      <div className="track on awarded" data-testid={`track-${id}`}>
        <div className="track-row">
          <span className="done">
            <Icon name="check" size={16} /> Done
          </span>
          <button type="button" className="linkbtn" onClick={() => mark(null)}>
            Undo
          </button>
        </div>
      </div>
    );

  return (
    <div className={`track on ${claim.state}`} data-testid={`track-${id}`}>
      <fieldset className="track-row">
        <legend className="sr-only">Progress with {s.name}</legend>
        {(["applied", "awarded", "refused"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={claim.state === k}
            onClick={() => mark(k)}
          >
            {claim.state === k && <Icon name="check" size={14} />} {LABEL[k]}
          </button>
        ))}
        <button type="button" className="linkbtn" onClick={() => mark(null)}>
          Undo
        </button>
      </fieldset>
      {claim.state === "applied" && (
        <p className="hint">
          Keep the letters they send. If a decision hasn't come in a few weeks,
          call and ask where it is.
        </p>
      )}
      {claim.state === "awarded" && (
        <p className="hint">
          {BENEFIT_OF[id]
            ? "Good news. The help it opens is now checked again above."
            : "Good news. Check the first payment is right when it arrives."}
        </p>
      )}
      {claim.state === "awarded" && keep && (
        <p className="hint keep">
          <b>To keep it:</b> {theyify(keep.text, subject)}{" "}
          <a href={keep.url} target="_blank" rel="noreferrer">
            More
          </a>
        </p>
      )}
      {claim.state === "refused" &&
        (challenge ? (
          <p className="hint">
            {theyify(challenge.text, subject)}{" "}
            <a href={challenge.url} target="_blank" rel="noreferrer">
              How to challenge
            </a>
          </p>
        ) : (
          <p className="hint">
            The refusal letter says how to ask for a review. Citizens Advice can
            help for free.
          </p>
        ))}
    </div>
  );
}
