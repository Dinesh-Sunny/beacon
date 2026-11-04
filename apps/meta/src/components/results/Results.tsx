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
  keepFor,
  nationOf,
  SCHEMES,
  type Status,
  timingFor,
  warnings,
  worthLabel,
  worthTotals,
} from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";
import { councilServiceUrl, shortCouncil, useCouncil } from "@/lib/council";
import { ClaimTrack } from "./ClaimTrack";
import { SchemeList } from "./lists";
import { MoreHelp } from "./MoreHelp";
import { ReadAloud } from "./ReadAloud";

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
  const haveSchemes = SCHEMES.filter((s) => states[s.id]?.status === "have");
  const have = haveSchemes.map((s) => s.name);
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
  const worth = worthTotals(states, answers);
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
        {worth.yearly + worth.once > 0 && (
          <p className="worth" data-testid="worth">
            <b>
              Up to{" "}
              {[
                worth.yearly
                  ? `£${worth.yearly.toLocaleString("en-GB")} a year`
                  : "",
                worth.once
                  ? `£${worth.once.toLocaleString("en-GB")} in one-off payments`
                  : "",
              ]
                .filter(Boolean)
                .join(" and ")}
            </b>{" "}
            <span className="hint">
              at the published rates, from {worth.count} of these. Each
              organisation decides the amount.
            </span>
          </p>
        )}
        {have.length > 0 && <Keeping schemes={haveSchemes} />}
        <ReadAloud
          lines={[
            `${total} ${total === 1 ? "thing looks" : "things look"} like ${whose}.`,
            ...(worth.yearly
              ? [
                  `Up to ${worth.yearly.toLocaleString("en-GB")} pounds a year at the published rates.`,
                ]
              : []),
            ...order
              .filter((p) => p.status !== "unlock")
              .map(
                (p, i) =>
                  `${i + 1}. ${byId[p.id]?.name}. ${p.when}. ${theyify(byId[p.id]?.gives ?? "", subject)}`,
              ),
            ...(unlock
              ? [`And ${unlock} more once a first claim is awarded.`]
              : []),
          ]}
        />
      </div>

      {warns.length > 0 && <GoodToKnow warns={warns} />}

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
      <MoreHelp />

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

/** What they already get, folded: open it to see what keeping each one needs (the Keep step). */
function Keeping({ schemes }: { schemes: typeof SCHEMES }) {
  const { subject } = useCheck();
  const withKeep = schemes
    .map((s) => ({ s, keep: keepFor(s) }))
    .filter((x) => x.keep);
  if (!withKeep.length)
    return (
      <p className="hint">
        Already getting: {schemes.map((s) => s.name).join(", ")}.
      </p>
    );
  return (
    <details className="keeping">
      <summary className="hint">
        Already getting: {schemes.map((s) => s.name).join(", ")}.{" "}
        <span className="linkbtn">How to keep it</span>
      </summary>
      <ul>
        {withKeep.map(({ s, keep }) => (
          <li key={s.id}>
            <b>{s.name}</b> {theyify(keep?.text ?? "", subject)}{" "}
            <a href={keep?.url} target="_blank" rel="noreferrer">
              More
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Clash warnings first, then the boosts; two show, the rest wait behind one quiet button. */
function GoodToKnow({ warns }: { warns: ReturnType<typeof warnings> }) {
  const [all, setAll] = useState(false);
  const sorted = [...warns].sort((a, b) =>
    a.tone === b.tone ? 0 : a.tone === "warn" ? -1 : 1,
  );
  const shown = all ? sorted : sorted.slice(0, 2);
  return (
    <div className="good-to-know">
      <span className="eyebrow">Good to know</span>
      {shown.map((w) => (
        <p key={w.text} className={`gtk ${w.tone}`}>
          <Icon name={w.tone === "boost" ? "spark" : "warn"} size={16} />
          <span>{w.text}</span>
        </p>
      ))}
      {sorted.length > 2 && (
        <button
          type="button"
          className="linkbtn"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
        >
          {all
            ? "Show fewer"
            : `${sorted.length - 2} more ${sorted.length - 2 === 1 ? "note" : "notes"}`}
        </button>
      )}
    </div>
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
  const council = useCouncil(answers.postcode);
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
  // Council services go straight to this person's council page when the postcode is known.
  const localUrl =
    s.council && council && nation !== "ni"
      ? councilServiceUrl(s.council, council.slug)
      : null;
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
        {worthLabel(s, answers) && status !== "unlock" && (
          <p className="amount">
            {theyify(worthLabel(s, answers) ?? "", subject)}{" "}
            <a href={s.worth?.source} target="_blank" rel="noreferrer">
              {s.worth?.year} rates
            </a>
          </p>
        )}
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
              href={localUrl ?? s.url}
              target="_blank"
              rel="noreferrer"
            >
              {localUrl && council
                ? `Apply to ${shortCouncil(council.name)}`
                : auto
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
        {s.list && status !== "unlock" && <SchemeList s={s} nation={nation} />}
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
