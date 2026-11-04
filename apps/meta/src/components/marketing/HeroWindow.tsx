"use client";

// The hero's product window: one example check (Margaret, 78, in Wembley) seen five ways. Tabs
// switch the view with a blur crossfade and a pill that slides to the active tab; the caption
// below says what each view is for. Names, amounts, rule lines and phone numbers come from the
// rule packs, so the window always shows what the app really says.

import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Icon, Logo } from "@/components/Icon";
import { byId, type Scheme } from "@/engine/rules";

const VIEWS = ["chat", "results", "plan", "call", "near"] as const;
type View = (typeof VIEWS)[number];

const scheme = (id: string) => byId[id] as Scheme;

export function HeroWindow() {
  const t = useTranslations("hero");
  const td = useTranslations("home.demo");
  const ts = useTranslations("status");
  const fmt = useFormatter();
  const [view, setView] = useState<View>("results");
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
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [view]);

  const money = (n: number) =>
    fmt.number(n, {
      style: "currency",
      currency: "GBP",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: n % 1 ? 2 : 0,
    });
  const aa = scheme("aa");
  const pc = scheme("pc");
  const ctr = scheme("ctr");
  const aaWorth = aa.worth;
  const rule = (s: Scheme, i: number) => s.rule[i]?.txt ?? "";

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
          <b>{t("windowTitle")}</b>
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
                    <Icon name="check" size={16} /> {t("chat.saved")}
                  </p>
                </div>
              )}

              {v === "results" && (
                <div className="hw-results">
                  <p className="hw-head">{t("results.head", { count: 2 })}</p>
                  {[
                    {
                      s: aa,
                      kind: "likely",
                      amount: aaWorth
                        ? t("results.range", {
                            min: money(aaWorth.min ?? aaWorth.max),
                            max: money(aaWorth.max),
                          })
                        : null,
                      rules: [rule(aa, 1), rule(aa, 2)],
                    },
                    {
                      s: pc,
                      kind: "likely",
                      amount: t("results.topUp"),
                      rules: [rule(pc, 0), rule(pc, 1)],
                    },
                    {
                      s: ctr,
                      kind: "check",
                      amount: t("results.council"),
                      rules: [rule(ctr, 0), rule(ctr, 2)],
                    },
                  ].map((r) => (
                    <article key={r.s.id} className={`hw-result ${r.kind}`}>
                      <div className="hw-result-top">
                        <b>{r.s.name}</b>
                        <em>{ts(r.kind as "likely")}</em>
                      </div>
                      {r.amount && <p className="hw-amount">{r.amount}</p>}
                      <ul className="hw-rules">
                        {r.rules.map((x) => (
                          <li key={x}>
                            <Icon name="check" size={14} /> {x}
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
                    {[aa, pc, ctr].map((s, i) => (
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
                  <p className="hw-head">{t("call.head", { name: aa.name })}</p>
                  <p className="hw-phone">
                    <Icon name="phone" size={20} /> {aa.phone}
                  </p>
                  <p>{aa.how}</p>
                  <p className="hw-quote">{t("call.say")}</p>
                  <p className="hw-next">
                    <Icon name="arrow" size={14} />{" "}
                    {t("call.after", { next: pc.name })}
                  </p>
                </div>
              )}

              {v === "near" && (
                <div className="hw-near">
                  <p className="hw-head">{t("near.head")}</p>
                  {(["ctr", "care", "adapt"] as const).map((k) => (
                    <div key={k} className="hw-near-row">
                      <Icon name="pin" size={16} />
                      <span>{t(`near.${k}`)}</span>
                      <em>{t("near.council")}</em>
                    </div>
                  ))}
                  <div className="hw-near-row">
                    <Icon name="pin" size={16} />
                    <span>{t("near.charity")}</span>
                    <em>{t("near.register")}</em>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="hw-caption" aria-live="polite">
        {t(`captions.${view}`)}
      </p>
    </div>
  );
}
