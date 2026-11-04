"use client";

// One quiet line under each claim: what you've done so far. It appears as a single link and
// grows only when used: applied shows what to expect, refused shows how to challenge, and an
// award of a gateway benefit opens the help that was waiting on it.

import { useTranslations } from "use-intl";
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

export function ClaimTrack({ id }: { id: string }) {
  const t = useTranslations("track");
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
          ? t("awardedOpened", {
              name: s.name,
              count: opened.length,
              names: opened.map((k) => byId[k]?.name).join(", "),
            })
          : t("awardedOnly", { name: s.name }),
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
            ? t("markDone")
            : subject.who === "me"
              ? t("iApplied")
              : t("theyApplied")}
        </button>
      </div>
    );

  // Things you join or ask for (a register, advice) are simply done; claims have a decision.
  if (s.act)
    return (
      <div className="track on awarded" data-testid={`track-${id}`}>
        <div className="track-row">
          <span className="done">
            <Icon name="check" size={16} /> {t("done")}
          </span>
          <button type="button" className="linkbtn" onClick={() => mark(null)}>
            {t("undo")}
          </button>
        </div>
      </div>
    );

  return (
    <div className={`track on ${claim.state}`} data-testid={`track-${id}`}>
      <fieldset className="track-row">
        <legend className="sr-only">
          {t("progressWith", { name: s.name })}
        </legend>
        {(["applied", "awarded", "refused"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={claim.state === k}
            onClick={() => mark(k)}
          >
            {claim.state === k && <Icon name="check" size={14} />} {t(k)}
          </button>
        ))}
        <button type="button" className="linkbtn" onClick={() => mark(null)}>
          {t("undo")}
        </button>
      </fieldset>
      {claim.state === "applied" && <p className="hint">{t("appliedHint")}</p>}
      {claim.state === "awarded" && (
        <p className="hint">
          {BENEFIT_OF[id] ? t("awardedOpens") : t("awardedPay")}
        </p>
      )}
      {claim.state === "awarded" && keep && (
        <p className="hint keep">
          <b>{t("toKeep")}</b> {theyify(keep.text, subject)}{" "}
          <a href={keep.url} target="_blank" rel="noreferrer">
            {t("more")}
          </a>
        </p>
      )}
      {claim.state === "refused" &&
        (challenge ? (
          <p className="hint">
            {theyify(challenge.text, subject)}{" "}
            <a href={challenge.url} target="_blank" rel="noreferrer">
              {t("challenge")}
            </a>
          </p>
        ) : (
          <p className="hint">{t("refusedHint")}</p>
        ))}
    </div>
  );
}
