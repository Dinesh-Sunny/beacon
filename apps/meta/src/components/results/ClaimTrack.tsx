"use client";

// One quiet line under each claim: what you've done so far. It appears as a single link and
// grows only when used: applied shows what to expect, refused shows how to challenge, and an
// award of a gateway benefit opens the help that was waiting on it.

import { Icon } from "@/components/Icon";
import { theyify } from "@/engine/facts";
import { BENEFIT_OF, byId, challengeFor } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { type ClaimState, useClaims } from "@/lib/claims";

const LABEL: Record<ClaimState, string> = {
  applied: "Applied",
  awarded: "Awarded",
  refused: "Refused",
};

export function ClaimTrack({ id }: { id: string }) {
  const { claims, setClaim } = useClaims();
  const { answers, apply, subject, announce } = useCheck();
  const s = byId[id];
  if (!s) return null;
  const claim = claims[id];
  const challenge = challengeFor(s);

  const mark = (state: ClaimState | null) => {
    setClaim(id, state);
    const b = BENEFIT_OF[id];
    if (state === "awarded" && b) {
      const have = Array.isArray(answers.benefits) ? answers.benefits : [];
      if (!have.includes(b as never))
        apply({ benefits: [...have, b] as typeof have }, "form");
      announce(`${s.name} awarded. Checked again for what it opens.`);
    }
  };

  if (!claim)
    return (
      <div className="track">
        <button
          type="button"
          className="linkbtn"
          onClick={() => mark("applied")}
          data-testid={`track-${id}`}
        >
          {subject.who === "me" ? "I've applied" : "They've applied"}
        </button>
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
