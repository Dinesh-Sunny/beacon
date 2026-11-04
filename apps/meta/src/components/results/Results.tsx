"use client";

// Results on the canvas: what looks like yours, the order to claim in, what to watch for, and a
// call script for each claim. Everything here comes from the rules engine; Muse Spark only writes
// the call scripts and Muse Image paints the banner.

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { byId, claimOrder, count, SCHEMES, type Status, warnings } from "@/engine/rules";
import { errorText } from "@/components/chat/ChatPanel";
import { useCheck } from "@/lib/check-store";

interface Prep {
  opening: string;
  mention: string[];
  have_ready: string[];
  they_may_ask: string[];
  phone: string | null;
  url: string;
}

export function Results() {
  const { states, next, answers } = useCheck();
  const done = !next;
  const likely = count(states, "likely");
  const check = count(states, "check");
  const unlock = count(states, "unlock");
  const order = claimOrder(states);
  const warns = warnings(states);
  const out = SCHEMES.filter((s) => states[s.id]?.status === "out");
  if (!likely && !check && !unlock) {
    return done ? (
      <section className="results empty" data-testid="results">
        <h2>Nothing stands out right now</h2>
        <p className="why">That can change when life does. Come back after a change in work, health, money or family.</p>
      </section>
    ) : null;
  }
  const total = likely + check;
  return (
    <section className="results" data-testid="results" aria-labelledby="res-h">
      <Banner done={done} likely={likely} />
      <div className="res-head">
        <span className="eyebrow">{done ? "Your results" : "Found so far"}</span>
        <h2 id="res-h">
          {total} {total === 1 ? "thing looks" : "things look"} like yours
        </h2>
        <p className="why">
          {likely} likely, {check} worth checking{unlock ? `, and ${unlock} more once your first claim is awarded` : ""}. The
          organisation that runs each one makes the final decision.
        </p>
        <div className="res-actions">
          <button type="button" className="btn ghost small" onClick={() => window.print()}>
            <Icon name="download" size={16} /> Save or print
          </button>
        </div>
      </div>

      {warns.length > 0 && (
        <div className="warns">
          {warns.map((w) => (
            <p key={w.text} className={`warn ${w.tone}`}>
              <Icon name={w.tone === "boost" ? "spark" : "warn"} size={18} />
              <span>{w.text}</span>
            </p>
          ))}
        </div>
      )}

      <ol className="plan" aria-label="Your claim plan">
        {order.map((p, i) => (
          <PlanStep key={p.id} id={p.id} n={i + 1} when={p.when} status={p.status} answers={answers} />
        ))}
      </ol>

      {out.length > 0 && (
        <details className="ruled-out">
          <summary>
            {out.length} not for you right now <span className="hint">and why</span>
          </summary>
          <ul>
            {out.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b> <span className="hint">{states[s.id]?.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const WHEN_TONE: Record<string, string> = { "Start now": "now", "This week": "week", "After the first award": "later" };
const STATUS_TXT: Partial<Record<Status, string>> = { likely: "Likely", check: "Worth checking", unlock: "Unlocks next" };

function PlanStep({ id, n, when, status, answers }: { id: string; n: number; when: string; status: Status; answers: unknown }) {
  const s = byId[id];
  const { states, note, setBusy } = useCheck();
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
        body: JSON.stringify({ scheme: id, answers }),
      });
      const data = (await res.json()) as Prep & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "model");
      setPrep(data);
      note("model", "Call coach", `Wrote a call script for ${s.name}`);
    } catch (e) {
      setErr(errorText((e as Error).message));
    } finally {
      setLoading(false);
      setBusy("Call coach", false);
    }
  };
  return (
    <li className={`step ${status}`} data-testid={`plan-${id}`}>
      <span className="num" aria-hidden="true">
        {status === "unlock" ? <Icon name="lock" size={16} /> : n}
      </span>
      <div className="step-body">
        <div className="step-top">
          <span className={`when ${WHEN_TONE[when] ?? ""}`}>{when}</span>
          <span className={`chip ${status}`}>{STATUS_TXT[status]}</span>
        </div>
        <h3>{s.name}</h3>
        <p>{s.gives}</p>
        {status === "check" && states[id]?.reason && <p className="hint">{states[id]?.reason}</p>}
        {status === "unlock" && <p className="hint">{states[id]?.reason}</p>}
        {s.timing && status !== "unlock" && (
          <p className="timing">
            <Icon name="clock" size={16} /> {s.timing}
          </p>
        )}
        {status !== "unlock" && (
          <div className="step-actions">
            {s.phone && (
              <a className="btn small" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                <Icon name="phone" size={16} /> {s.phone}
              </a>
            )}
            <a className="btn ghost small" href={s.url} target="_blank" rel="noreferrer">
              {s.phone ? "Online" : "Start your claim"} <Icon name="link" size={16} />
            </a>
            <button type="button" className="btn ghost small" onClick={() => (open ? setOpen(false) : void load())} aria-expanded={open} data-testid={`prep-${id}`}>
              <Icon name="spark" size={16} /> {open ? "Hide what to say" : "What to say"}
            </button>
          </div>
        )}
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
  const topics = [...new Set(SCHEMES.filter((s) => ["likely", "check"].includes(states[s.id]?.status ?? "")).map((s) => s.topic))];
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
    fetch("/api/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics }) })
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
  if (!done || !likely) return null;
  return (
    <div className={`banner${img ? " ready" : ""}`} aria-hidden="true" data-testid="banner">
      {img ? <img src={img} alt="" /> : <span className="banner-glow" />}
    </div>
  );
}
