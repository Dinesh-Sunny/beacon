"use client";

// The support board: every stored scheme, grouped by life area, narrowing live as answers arrive.
// Tapping a scheme opens its sheet with each condition and how it stands right now.

import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { theyify } from "@/engine/facts";
import { byId, howFor, nationIn } from "@/engine/rules";
import { useStatusText } from "@/i18n/useStatusText";
import { useCheck } from "@/lib/check-store";

export function SchemeSheet() {
  const { selected, select, states, subject, answers } = useCheck();
  const t = useTranslations("board");
  const statusText = useStatusText();
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, select]);
  if (!selected) return null;
  const s = byId[selected];
  const st = states[selected];
  if (!s || !st) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes; Escape and the close button also do
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled on window
    <div className="sheet-back" onClick={() => select(null)}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop close */}
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-h"
        onClick={(e) => e.stopPropagation()}
        data-testid="sheet"
      >
        <div className="sheet-head">
          <div>
            <span className="eyebrow">{s.by}</span>
            <h2 id="sheet-h" style={{ fontSize: "1.6rem", marginTop: 4 }}>
              {s.name}
            </h2>
          </div>
          <button
            type="button"
            className="iconbtn"
            onClick={() => select(null)}
            aria-label={t("close")}
          >
            <Icon name="close" />
          </button>
        </div>
        <p>{theyify(s.gives, subject)}</p>
        <div className={`sc ${st.status}`} style={{ cursor: "default" }}>
          <span className="nm">{statusText(st.status)}</span>
          {st.reason ? <span className="rs">{st.reason}</span> : null}
        </div>
        <span className="eyebrow">{t("conditions")}</span>
        <ul className="rule">
          {s.rule.map((r, i) => {
            const m = st.marks[i];
            return (
              <li key={r.expr}>
                <span
                  className={`m ${m === true ? "t" : m === false ? "f" : "u"}`}
                  aria-hidden="true"
                >
                  {m === true ? "✓" : m === false ? "×" : "?"}
                </span>
                <span>
                  {/* A condition near a money line says the number; the rest read as written. */}
                  {r.near
                    ? r.expr.charAt(0).toUpperCase() + r.expr.slice(1)
                    : r.txt}
                  <span className="sr-only">
                    {" "}
                    {m === true
                      ? t("met")
                      : m === false
                        ? t("notMet")
                        : t("unknown")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {s.opens ? (
          <p className="hint">
            {t("opens", {
              names: s.opens.map((o) => byId[o]?.name).join(", "),
            })}
          </p>
        ) : null}
        <p className="hint">{theyify(howFor(s, nationIn(answers)), subject)}</p>
        <a
          className="btn ghost small"
          href={s.url}
          target="_blank"
          rel="noreferrer"
        >
          {t("officialPage")} <Icon name="link" size={16} />
        </a>
      </div>
    </div>
  );
}
