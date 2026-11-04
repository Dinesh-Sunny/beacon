"use client";

// The hero's product window: one example check seen five ways, for the country the person chose
// (Margaret in Wembley for the UK, Walter in Ohio for the US). Tabs switch the view with a blur
// crossfade and a pill that slides to the active tab; the caption says what each view is for.
// Names, amounts, rule lines and phone numbers come from the rule packs, so the window always
// shows what the app really says.

import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Icon, Logo } from "@/components/Icon";
import { byId, type Scheme } from "@/engine/rules";

const VIEWS = ["chat", "results", "plan", "call", "near"] as const;
type View = (typeof VIEWS)[number];
type Kind = "likely" | "check";

/** Each country's example: who, which schemes in what order, and which rule lines to show. */
const EXAMPLES = {
  GB: {
    name: "Margaret",
    demo: "home.demo",
    currency: "GBP",
    results: [
      { id: "aa", kind: "likely", rules: [1, 2], amount: "range" },
      { id: "pc", kind: "likely", rules: [0, 1], amount: "topUp" },
      { id: "ctr", kind: "check", rules: [0, 2], amount: "council" },
    ],
    call: "aa",
    next: "pc",
    near: ["ctr", "care", "adapt", "charity"],
  },
  US: {
    name: "Walter",
    demo: "home.demoUs",
    currency: "USD",
    results: [
      { id: "msp", kind: "likely", rules: [0, 2], amount: "upTo" },
      { id: "extrahelp", kind: "likely", rules: [0, 2], amount: "drugs" },
      { id: "snap", kind: "check", rules: [0], amount: "state" },
    ],
    call: "extrahelp",
    next: "snap",
    near: ["clinic", "housing", "counsellor", "found"],
  },
} as const;

const scheme = (id: string) => byId[id] as Scheme;

export function HeroWindow({ country }: { country: "GB" | "US" }) {
  const ex = EXAMPLES[country];
  const us = country === "US";
  const t = useTranslations("hero");
  const td = useTranslations(ex.demo);
  const ts = useTranslations("status");
  const fmt = useFormatter();
  const [view, setView] = useState<View>("chat");
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // The pill follows the active tab, measured so it fits every language's label.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the view changes
  useEffect(() => {
    const measure = () => {
      const el = tabs.current?.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (el) {
        setPill({ x: el.offsetLeft, w: el.offsetWidth });
        // Where the tabs scroll (long languages on a phone), keep the open one in view.
        const box = tabs.current;
        if (box && box.scrollWidth > box.clientWidth)
          box.scrollTo({
            left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
            behavior: "smooth",
          });
      }
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [view]);

  const money = (n: number) =>
    fmt.number(n, {
      style: "currency",
      currency: ex.currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: n % 1 ? 2 : 0,
    });
  const amount = (s: Scheme, kind: string): string => {
    const w = s.worth;
    if (kind === "range" && w)
      return t("results.range", {
        min: money(w.min ?? w.max),
        max: money(w.max),
      });
    if (kind === "upTo" && w)
      return t("results.upToMonth", { max: money(w.max) });
    return t(`results.${kind}` as "results.topUp");
  };
  const results = ex.results.map((r) => ({ ...r, s: scheme(r.id) }));
  const callS = scheme(ex.call);
  const nextS = scheme(ex.next);

  // Arrow keys move between tabs, as in any tab list.
  const onKey = (e: React.KeyboardEvent) => {
    const i = VIEWS.indexOf(view);
    const next =
      e.key === "ArrowRight"
        ? VIEWS[(i + 1) % VIEWS.length]
        : e.key === "ArrowLeft"
          ? VIEWS[(i + VIEWS.length - 1) % VIEWS.length]
          : null;
    if (!next) return;
    e.preventDefault();
    setView(next);
    tabs.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-tab-${next}`)}`)
      ?.focus();
  };

  return (
    <div className="hw">
      <div
        className="hw-tabs"
        role="tablist"
        aria-label={t("tabsLabel")}
        ref={tabs}
        onKeyDown={onKey}
      >
        {pill && (
          <span
            className="hw-pill"
            aria-hidden="true"
            style={{ translate: `${pill.x}px 0`, width: pill.w }}
          />
        )}
        {VIEWS.map((v) => (
          <button
            key={v}
            id={`${id}-tab-${v}`}
            type="button"
            role="tab"
            aria-selected={v === view}
            aria-controls={`${id}-panel`}
            tabIndex={v === view ? 0 : -1}
            onClick={() => setView(v)}
          >
            {t(`tabs.${v}`)}
          </button>
        ))}
      </div>

      <div className="hw-frame">
        <div className="hw-bar">
          <Logo size={18} />
          <b>{t("windowTitle", { name: ex.name })}</b>
          <span className="hw-tag">{td("tag")}</span>
        </div>
        <div
          className="hw-stage"
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${view}`}
        >
          {VIEWS.map((v) => (
            <div
              key={v}
              className={`hw-view${v === view ? " on" : ""}`}
              aria-hidden={v !== view}
              inert={v !== view}
            >
              {v === "chat" && (
                <div className="hw-chat">
                  <p className="mk-bubble you on">{td("you1")}</p>
                  <p className="mk-bubble beacon on">{td("ask")}</p>
                  <p className="mk-bubble you on">{td("you2")}</p>
                  <p className="hw-saved">
                    <Icon name="check" size={16} />{" "}
                    {t(us ? "chat.savedUs" : "chat.saved")}
                  </p>
                </div>
              )}

              {v === "results" && (
                <div className="hw-results">
                  <p className="hw-head">{t("results.head", { count: 2 })}</p>
                  {results.map((r) => (
                    <article key={r.s.id} className={`hw-result ${r.kind}`}>
                      <div className="hw-result-top">
                        <b>{r.s.name}</b>
                        <em>{ts(r.kind as Kind)}</em>
                      </div>
                      <p className="hw-amount">{amount(r.s, r.amount)}</p>
                      <ul className="hw-rules">
                        {r.rules.map((i) => (
                          <li key={i}>
                            <Icon name="check" size={14} /> {r.s.rule[i]?.txt}
                          </li>
                        ))}
                      </ul>
                      <span className="hw-source">
                        <Icon name="link" size={12} />{" "}
                        {new URL(r.s.url).hostname.replace(/^www\./, "")}
                      </span>
                    </article>
                  ))}
                </div>
              )}

              {v === "plan" && (
                <div className="hw-plan">
                  <p className="hw-warn">
                    <Icon name="spark" size={16} /> {td("note")}
                  </p>
                  <ol>
                    {results.map(({ s }, i) => (
                      <li key={s.id}>
                        <span className="n">{i + 1}</span>
                        <div>
                          <b>{s.name}</b>
                          <span>{s.how}</span>
                        </div>
                        {i === 0 && <em>{t("plan.now")}</em>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {v === "call" && (
                <div className="hw-call">
                  <p className="hw-head">
                    {t("call.head", { name: callS.name })}
                  </p>
                  {callS.phone && (
                    <p className="hw-phone">
                      <Icon name="phone" size={20} /> {callS.phone}
                    </p>
                  )}
                  <p>{callS.how}</p>
                  <p className="hw-quote">
                    {t(us ? "call.sayUs" : "call.say")}
                  </p>
                  <p className="hw-next">
                    <Icon name="arrow" size={14} />{" "}
                    {t("call.after", { next: nextS.name })}
                  </p>
                </div>
              )}

              {v === "near" && (
                <div className="hw-near">
                  <p className="hw-head">
                    {t(us ? "near.headUs" : "near.head")}
                  </p>
                  {ex.near.map((k) => (
                    <div key={k} className="hw-near-row">
                      <Icon name="pin" size={16} />
                      <span>{t(`near.${k}`)}</span>
                      <em>{t(`near.${k}From` as "near.ctrFrom")}</em>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="hw-caption" aria-live="polite">
        {t(
          view === "near" && us
            ? "captions.nearUs"
            : (`captions.${view}` as "captions.chat"),
        )}
      </p>
    </div>
  );
}
