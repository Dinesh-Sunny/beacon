"use client";

// Results on the canvas: what looks like yours, the order to claim in, what to watch for, and a
// call script for each claim. Everything here comes from the rules engine; Muse Spark only writes
// the call scripts and Muse Image paints the banner.

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { type Answers, theyify } from "@/engine/facts";
import {
  byId,
  claimOrder,
  count,
  howFor,
  isAuto,
  nationOf,
  SCHEMES,
  type Status,
  timingFor,
  warnings,
} from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";
import { ClaimTrack } from "./ClaimTrack";

interface Prep {
  opening: string;
  mention: string[];
  have_ready: string[];
  they_may_ask: string[];
  phone: string | null;
  url: string;
}

export function Results() {
  const { states, next, answers, subject } = useCheck();
  const whose = subject.who === "me" ? "yours" : `${subject.label}'s`;
  const done = !next;
  const likely = count(states, "likely");
  const check = count(states, "check");
  const unlock = count(states, "unlock");
  const nation =
    typeof answers.postcode === "string" ? nationOf(answers.postcode) : null;
  const order = claimOrder(states, nation);
  const warns = warnings(states, answers);
  const out = SCHEMES.filter((s) => states[s.id]?.status === "out");
  const have = SCHEMES.filter((s) => states[s.id]?.status === "have").map(
    (s) => s.name,
  );
  if (!likely && !check && !unlock) {
    return done ? (
      <section className="results empty" data-testid="results">
        <h2>Nothing stands out right now</h2>
        <p className="why">
          That can change when life does. Come back after a change in work,
          health, money or family.
        </p>
      </section>
    ) : null;
  }
  const total = likely + check;
  return (
    <section className="results" data-testid="results" aria-labelledby="res-h">
      <Banner done={done} likely={likely} />
      <div className="res-head">
        <span className="eyebrow">
          {done ? "Your results" : "Found so far"}
        </span>
        <h2 id="res-h">
          {total} {total === 1 ? "thing looks" : "things look"} like {whose}
        </h2>
        <p className="why">
          {[
            likely ? `${likely} likely` : "",
            check ? `${check} worth checking` : "",
            unlock ? `${unlock} more once a first claim is awarded` : "",
          ]
            .filter(Boolean)
            .join(", ")}
          .
        </p>
        {have.length > 0 && (
          <p className="hint">Already getting: {have.join(", ")}.</p>
        )}
      </div>

      {warns.length > 0 && (
        <div className="good-to-know">
          <span className="eyebrow">Good to know</span>
          {warns.map((w) => (
            <p key={w.text} className={`gtk ${w.tone}`}>
              <Icon name={w.tone === "boost" ? "spark" : "warn"} size={16} />
              <span>{w.text}</span>
            </p>
          ))}
        </div>
      )}

      <ol className="plan" aria-label="Your claim plan">
        {order.map((p, i) => (
          <PlanStep
            key={p.id}
            id={p.id}
            n={i + 1}
            when={p.when}
            status={p.status}
            answers={answers}
          />
        ))}
      </ol>

      <div className="res-foot">
        <p className="hint">
          The organisation that runs each one makes the final decision.
        </p>
        {done && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => window.print()}
          >
            <Icon name="download" size={16} /> Save or print
          </button>
        )}
      </div>

      {out.length > 0 && (
        <details className="ruled-out">
          <summary>
            {out.length} not for {subject.who === "me" ? "you" : subject.label}{" "}
            right now <span className="hint">and why</span>
          </summary>
          <ul>
            {out.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b>{" "}
                <span className="hint">{states[s.id]?.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const WHEN_TONE: Record<string, string> = {
  "Start now": "now",
  "This week": "week",
  "After the first award": "later",
};

function PlanStep({
  id,
  n,
  when,
  status,
  answers,
}: {
  id: string;
  n: number;
  when: string;
  status: Status;
  answers: Answers;
}) {
  const s = byId[id];
  const { states, note, setBusy, subject } = useCheck();
  const [prep, setPrep] = useState<Prep | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const load = async () => {
    setOpen(true);
    if (prep || loading) return;
    setLoading(true);
    setErr("");
    setBusy("Call coach", true);
    try {
      const res = await fetch("/api/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheme: id, answers, subject }),
      });
      const data = (await res.json()) as Prep & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "model");
      setPrep(data);
      note("model", "Call coach", `Wrote a call script for ${s.name}`);
    } catch (e) {
      setErr(
        (e as Error).message === "offline"
          ? "Call notes need the reading tools, which are resting right now. The number and the official page above still work."
          : "Those notes didn't come through. Try again in a moment.",
      );
    } finally {
      setLoading(false);
      setBusy("Call coach", false);
    }
  };
  const nation =
    typeof answers.postcode === "string" ? nationOf(answers.postcode) : null;
  const auto = isAuto(s, nation);
  const timing = timingFor(s, nation);
  return (
    <li className={`step ${status}`} data-testid={`plan-${id}`}>
      <span className="num" aria-hidden="true">
        {status === "unlock" ? <Icon name="lock" size={14} /> : n}
      </span>
      <div className="step-body">
        <div className="step-top">
          {auto && status !== "unlock" ? (
            <span className="when">Usually automatic</span>
          ) : (
            <span className={`when ${WHEN_TONE[when] ?? ""}`}>{when}</span>
          )}
          {status !== "likely" && (
            <span className={`chip ${status}`}>{STATUS_TXT[status]}</span>
          )}
        </div>
        <h3>{s.name}</h3>
        <p>{theyify(s.gives, subject)}</p>
        {status === "check" && states[id]?.reason && (
          <p className="hint">{states[id]?.reason}</p>
        )}
        {status === "unlock" && <p className="hint">{states[id]?.reason}</p>}
        {(auto || s.act) && status !== "unlock" && (
          <p className="hint">
            {theyify(
              howFor(
                s,
                typeof answers.postcode === "string"
                  ? nationOf(answers.postcode)
                  : null,
              ),
              subject,
            )}
          </p>
        )}
        {timing && status !== "unlock" && (
          <p className="timing">
            <Icon name="clock" size={16} /> {theyify(timing, subject)}
          </p>
        )}
        {status !== "unlock" && (
          <div className="step-actions">
            {s.phone && (
              <a
                className="btn small"
                href={`tel:${s.phone.replace(/\s/g, "")}`}
              >
                <Icon name="phone" size={16} /> {s.phone}
              </a>
            )}
            <a
              className="btn ghost small"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {auto
                ? "Official page"
                : s.act
                  ? theyify(s.act, subject)
                  : "Claim online"}{" "}
              <Icon name="link" size={16} />
            </a>
            {!auto && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => (open ? setOpen(false) : void load())}
                aria-expanded={open}
                data-testid={`prep-${id}`}
              >
                <Icon name="spark" size={16} />{" "}
                {open ? "Hide what to say" : "What to say"}
              </button>
            )}
          </div>
        )}
        {status !== "unlock" && !auto && <ClaimTrack id={id} />}
        {open && (
          <div className="prep" aria-live="polite">
            {loading && <p className="hint">Writing your call notes…</p>}
            {err && <p className="hint">{err}</p>}
            {prep && (
              <>
                <p className="opening">"{prep.opening}"</p>
                {prep.mention.length > 0 && (
                  <>
                    <span className="eyebrow">Worth saying</span>
                    <ul>
                      {prep.mention.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {prep.have_ready.length > 0 && (
                  <>
                    <span className="eyebrow">Have these to hand</span>
                    <ul>
                      {prep.have_ready.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {prep.they_may_ask.length > 0 && (
                  <>
                    <span className="eyebrow">They may ask</span>
                    <ul>
                      {prep.they_may_ask.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Muse Image banner, painted once per set of results and kept for this browser session. */
function Banner({ done, likely }: { done: boolean; likely: number }) {
  const { states, note, setBusy } = useCheck();
  const [img, setImg] = useState<string | null>(null);
  const topics = [
    ...new Set(
      SCHEMES.filter((s) =>
        ["likely", "check"].includes(states[s.id]?.status ?? ""),
      ).map((s) => s.topic),
    ),
  ];
  const key = `beacon:banner:${topics.sort().join(",")}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: paint once per topic set
  useEffect(() => {
    if (!done || !likely || !topics.length) return;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setImg(cached);
        return;
      }
    } catch {
      /* no storage */
    }
    let alive = true;
    setBusy("Muse Image", true);
    fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
    })
      .then((r) => r.json() as Promise<{ image?: string }>)
      .then((d) => {
        if (!alive || !d.image) return;
        setImg(d.image);
        note("model", "Muse Image", "Painted your results banner");
        try {
          sessionStorage.setItem(key, d.image);
        } catch {
          /* too big for storage: fine */
        }
      })
      .catch(() => {})
      .finally(() => setBusy("Muse Image", false));
    return () => {
      alive = false;
    };
  }, [done, key]);
  if (!done || !likely || !img) return null;
  return (
    <div className="banner" aria-hidden="true" data-testid="banner">
      {/* biome-ignore lint/performance/noImgElement: a generated data URL, shown once; next/image can't optimise it */}
      <img src={img} alt="" />
    </div>
  );
}
