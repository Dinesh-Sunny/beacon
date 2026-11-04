"use client";

// Results on the canvas: what looks like yours, the order to claim in, what to watch for, and a
// call script for each claim. Everything here comes from the rules engine; Muse Spark only writes
// the call scripts and Muse Image paints the banner.

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { type Answers, currencyOf, theyify } from "@/engine/facts";
import {
  byId,
  claimOrder,
  count,
  howFor,
  isAuto,
  keepFor,
  nationIn,
  SCHEMES,
  type Status,
  timingFor,
  warnings,
  worthFor,
  worthLabel,
  worthTotals,
} from "@/engine/rules";
import { STATUS_TXT, useCheck } from "@/lib/check-store";
import { useClaims } from "@/lib/claims";
import { councilServiceUrl, shortCouncil, useCouncil } from "@/lib/council";
import { ClaimTrack } from "./ClaimTrack";
import { LocalHelp } from "./LocalHelp";
import { SchemeList } from "./lists";
import { MoreHelp } from "./MoreHelp";
import { ReadAloud } from "./ReadAloud";
import { ShareCheck } from "./ShareCheck";
import { UsLocalHelp } from "./UsLocalHelp";

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
  const t = useTranslations("results");
  const tl = useTranslations("lang");
  const locale = useLocale();
  const fmt = useFormatter();
  const gbp = (n: number) =>
    fmt.number(n, {
      style: "currency",
      currency: currencyOf(answers.country),
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });
  const me = subject.who === "me";
  const headline = (count: number) =>
    me
      ? t("headlineMe", { count })
      : t("headlineThey", { count, name: subject.label ?? "" });
  const done = !next;
  const likely = count(states, "likely");
  const check = count(states, "check");
  const unlock = count(states, "unlock");
  const nation = nationIn(answers);
  const order = claimOrder(states, nation);
  const warns = warnings(states, answers);
  const out = SCHEMES.filter((s) => states[s.id]?.status === "out");
  const haveSchemes = SCHEMES.filter((s) => states[s.id]?.status === "have");
  const have = haveSchemes.map((s) => s.name);
  if (!likely && !check && !unlock) {
    return done ? (
      <section className="results empty" data-testid="results">
        <h2>{t("nothingTitle")}</h2>
        <p className="why">{t("nothingBody")}</p>
      </section>
    ) : null;
  }
  const total = likely + check;
  const worth = worthTotals(states, answers);
  // Two or three things to do first, then the rest as compact rows, so the plan has a clear start.
  const autoHere = (id: string) => {
    const s = byId[id];
    return s ? isAuto(s, nationIn(answers)) : false;
  };
  // First: gateway and time-sensitive claims, then the best-paying likely claims; advice and
  // registers come first only when there's nothing to claim.
  const value = (id: string) => {
    const s = byId[id];
    const w = s ? worthFor(s, answers) : null;
    return w ? w.max * { week: 52, month: 12, year: 1, once: 1 }[w.per] : 0;
  };
  const claimable = order.filter(
    (p) => p.status === "likely" && !autoHere(p.id),
  );
  const isClaim = (id: string) => !byId[id]?.act;
  const ranked = [
    ...claimable.filter((p) => p.when === "Start now" && isClaim(p.id)),
    ...claimable
      .filter((p) => p.when !== "Start now" && isClaim(p.id))
      .sort((a, b) => value(b.id) - value(a.id)),
    ...claimable.filter((p) => !isClaim(p.id)),
  ];
  const firstIds = new Set(ranked.slice(0, 3).map((p) => p.id));
  const rest = order.filter((p) => !firstIds.has(p.id));
  const groups = [
    {
      title: t("first"),
      fold: false,
      steps: ranked.slice(0, 3),
    },
    {
      title: t("then"),
      fold: true,
      steps: rest.filter((p) => p.status === "likely" && !autoHere(p.id)),
    },
    {
      title: t("worth"),
      fold: true,
      steps: rest.filter((p) => p.status === "check" && !autoHere(p.id)),
    },
    {
      title: t("auto"),
      fold: true,
      steps: rest.filter((p) => p.status !== "unlock" && autoHere(p.id)),
    },
    {
      title: t("later"),
      fold: true,
      steps: rest.filter((p) => p.status === "unlock"),
    },
  ].filter((g) => g.steps.length);
  const numbering = new Map(
    groups.flatMap((g) => g.steps).map((p, i) => [p.id, i]),
  );
  return (
    <section className="results" data-testid="results" aria-labelledby="res-h">
      <Banner done={done} likely={likely} />
      <div className="res-head">
        <div className="res-top">
          <span className="eyebrow">{done ? t("yours") : t("soFar")}</span>
        </div>
        <h2 id="res-h">{headline(total)}</h2>
        {locale !== "en" && <p className="hint">{tl("official")}</p>}
        {(check > 0 || unlock > 0) && (
          <p className="why">
            {[
              t("likelyN", { count: likely }),
              check ? t("checkN", { count: check }) : "",
              unlock ? t("unlockN", { count: unlock }) : "",
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        )}
        {worth.yearly + worth.once > 0 && (
          <p className="worth" data-testid="worth">
            <b>
              {t("worthUpTo", {
                amounts: [
                  worth.yearly
                    ? t("perYear", { amount: gbp(worth.yearly) })
                    : "",
                  worth.once ? t("oneOff", { amount: gbp(worth.once) }) : "",
                ]
                  .filter(Boolean)
                  .join(t("and")),
              })}
            </b>{" "}
            <span className="hint">
              {t("worthFrom", { count: worth.count })}
              {likely > worth.count
                ? t(me ? "worthPlusMe" : "worthPlusThey", {
                    count: likely - worth.count,
                  })
                : ""}
              {t("worthDecides")}
            </span>
          </p>
        )}
        {have.length > 0 && <Keeping schemes={haveSchemes} />}
        <ReadAloud
          lines={[
            `${headline(total)}.`,
            ...(worth.yearly
              ? [t("readUpTo", { amount: gbp(worth.yearly) })]
              : []),
            ...order
              .filter((p) => p.status !== "unlock")
              .map(
                (p, i) =>
                  `${i + 1}. ${byId[p.id]?.name}. ${whenText(t, p.when)}. ${theyify(byId[p.id]?.gives ?? "", subject)}`,
              ),
            ...(unlock ? [t("readAnd", { count: unlock })] : []),
          ]}
        />
      </div>

      {warns.length > 0 && <GoodToKnow warns={warns} />}

      {groups.map((g) => (
        <section key={g.title} className="plan-group" aria-label={g.title}>
          <h3 className="eyebrow plan-title">{g.title}</h3>
          <ol className="plan">
            {g.steps.map((p) => (
              <PlanStep
                key={p.id}
                id={p.id}
                n={(numbering.get(p.id) ?? 0) + 1}
                when={p.when}
                status={p.status}
                answers={answers}
                fold={g.fold}
              />
            ))}
          </ol>
        </section>
      ))}
      <LocalHelp />
      <UsLocalHelp />
      <MoreHelp />

      <div className="res-foot">
        <p className="hint">{t("finalDecision")}</p>
        {done && (
          <div className="res-actions">
            <ShareCheck />
            <button
              type="button"
              className="btn ghost small"
              onClick={() => window.print()}
            >
              <Icon name="download" size={16} /> {t("print")}
            </button>
          </div>
        )}
      </div>

      {out.length > 0 && (
        <details className="ruled-out">
          <summary>
            {me
              ? t("outMe", { count: out.length })
              : t("outThey", {
                  count: out.length,
                  name: subject.label ?? "",
                })}{" "}
            <span className="hint">{t("andWhy")}</span>
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
  const t = useTranslations("results");
  const names = schemes.map((s) => s.name).join(", ");
  const withKeep = schemes
    .map((s) => ({ s, keep: keepFor(s) }))
    .filter((x) => x.keep);
  if (!withKeep.length)
    return <p className="hint">{t("already", { names })}</p>;
  return (
    <details className="keeping">
      <summary className="hint">
        {t("already", { names })}{" "}
        <span className="linkbtn">{t("howKeep")}</span>
      </summary>
      <ul>
        {withKeep.map(({ s, keep }) => (
          <li key={s.id}>
            <b>{s.name}</b> {theyify(keep?.text ?? "", subject)}{" "}
            <a href={keep?.url} target="_blank" rel="noreferrer">
              {t("more")}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Clash warnings first, then the boosts; two show, the rest wait behind one quiet button. */
function GoodToKnow({ warns }: { warns: ReturnType<typeof warnings> }) {
  const t = useTranslations("results");
  const [all, setAll] = useState(false);
  const sorted = [...warns].sort((a, b) =>
    a.tone === b.tone ? 0 : a.tone === "warn" ? -1 : 1,
  );
  const shown = all ? sorted : sorted.slice(0, 2);
  return (
    <div className="good-to-know">
      <span className="eyebrow">{t("goodToKnow")}</span>
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
          {all ? t("fewer") : t("moreNotes", { count: sorted.length - 2 })}
        </button>
      )}
    </div>
  );
}

/** The engine's timing words, in the reader's language. */
const WHEN_KEY = {
  "Start now": "startNow",
  "This week": "thisWeek",
  "After the first award": "afterFirst",
} as const;
const whenText = (
  t: ReturnType<typeof useTranslations<"results">>,
  when: string,
) => {
  const k = WHEN_KEY[when as keyof typeof WHEN_KEY];
  return k ? t(k) : when;
};

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
  fold = false,
}: {
  id: string;
  n: number;
  when: string;
  status: Status;
  answers: Answers;
  /** Later steps start as one compact row and open on tap. */
  fold?: boolean;
}) {
  const s = byId[id];
  const t = useTranslations("results");
  const { states, note, setBusy, subject } = useCheck();
  const council = useCouncil(answers.postcode);
  const { fresh } = useClaims();
  const [prep, setPrep] = useState<Prep | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(!fold);
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
      setErr((e as Error).message === "offline" ? t("offline") : t("failed"));
    } finally {
      setLoading(false);
      setBusy("Call coach", false);
    }
  };
  const nation = nationIn(answers);
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
        {when === "Start now" && (
          <div className="step-top">
            <span className={`when ${WHEN_TONE[when] ?? ""}`}>
              {whenText(t, when)}
            </span>
          </div>
        )}
        <h3>
          {s.name}
          {fresh.includes(id) && <span className="chip new">{t("new")}</span>}
        </h3>
        <p>{theyify(s.gives, subject)}</p>
        {worthLabel(s, answers) && status !== "unlock" && (
          <p className="amount">
            {theyify(worthLabel(s, answers) ?? "", subject)}{" "}
            <a href={s.worth?.source} target="_blank" rel="noreferrer">
              {t("rates", { year: s.worth?.year ?? "" })}
            </a>
          </p>
        )}
        {!shown && (
          <button
            type="button"
            className="linkbtn step-open"
            onClick={() => setShown(true)}
            aria-expanded={false}
          >
            {status === "unlock"
              ? t("whyWaits")
              : auto
                ? t("howArrives")
                : t("howClaim")}
          </button>
        )}
        {shown && (
          <>
            {status === "check" && states[id]?.reason && (
              <p className="hint">{states[id]?.reason}</p>
            )}
            {status === "unlock" && (
              <p className="hint">{states[id]?.reason}</p>
            )}
            {(auto || s.act) && status !== "unlock" && (
              <p className="hint">
                {theyify(howFor(s, nationIn(answers)), subject)}
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
                    ? t("applyTo", { council: shortCouncil(council.name) })
                    : auto
                      ? t("officialPage")
                      : s.act
                        ? theyify(s.act, subject)
                        : t("claimOnline")}{" "}
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
                    {open ? t("hideWhatToSay") : t("whatToSay")}
                  </button>
                )}
              </div>
            )}
            {s.list && status !== "unlock" && (
              <SchemeList s={s} nation={nation} />
            )}
            {status !== "unlock" && !auto && <ClaimTrack id={id} />}
            {open && (
              <div className="prep" aria-live="polite">
                {loading && <p className="hint">{t("writing")}</p>}
                {err && <p className="hint">{err}</p>}
                {prep && (
                  <>
                    <p className="opening">"{prep.opening}"</p>
                    {prep.mention.length > 0 && (
                      <>
                        <span className="eyebrow">{t("sayThis")}</span>
                        <ul>
                          {prep.mention.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {prep.have_ready.length > 0 && (
                      <>
                        <span className="eyebrow">{t("haveReady")}</span>
                        <ul>
                          {prep.have_ready.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {prep.they_may_ask.length > 0 && (
                      <>
                        <span className="eyebrow">{t("mayAsk")}</span>
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
          </>
        )}
      </div>
    </li>
  );
}

/** Muse Image banner, painted once per set of results and kept for this browser session. */
function Banner({ done, likely }: { done: boolean; likely: number }) {
  const { states, note, setBusy, answers } = useCheck();
  const country = answers.country === "US" ? "US" : "GB";
  const [img, setImg] = useState<string | null>(null);
  const topics = [
    ...new Set(
      SCHEMES.filter((s) =>
        ["likely", "check"].includes(states[s.id]?.status ?? ""),
      ).map((s) => s.topic),
    ),
  ];
  const key = `beacon:banner:${country}:${topics.sort().join(",")}`;
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
      body: JSON.stringify({ topics, country }),
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
