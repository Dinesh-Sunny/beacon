"use client";

// Every kind of help Beacon checks, grouped by area of life. Each area is one row of dots that
// light up as answers settle them, so the canvas stays calm with hundreds of schemes. Open an
// area to see its tiles; tap a tile to see each condition and how it stands.

import { useTranslations } from "use-intl";
import { inPlay, RANK, type Scheme, type Status, TOPICS } from "@/engine/rules";
import { useStatusText } from "@/i18n/useStatusText";
import { useCheck } from "@/lib/check-store";

const SHOWN: Status[] = ["likely", "check", "unlock", "have"];
const COUNT_KEY = {
  likely: "countLikely",
  check: "countCheck",
  unlock: "countUnlock",
  have: "countHave",
} as const;

export function Constellation() {
  const { states, changed, select } = useCheck();
  const t = useTranslations("board");
  const tt = useTranslations("topics");
  const statusText = useStatusText();
  const status = (s: Scheme): Status => states[s.id]?.status ?? "open";
  const areas = TOPICS.map(([t, name]) => {
    const list = inPlay(states)
      .filter((s) => s.topic === t)
      .sort((a, b) => RANK[status(a)] - RANK[status(b)]);
    return {
      t,
      name,
      list,
      best: Math.min(...list.map((s) => RANK[status(s)])),
    };
  })
    .filter((a) => a.list.length)
    .sort((a, b) => a.best - b.best);

  return (
    <details className="constellation" data-testid="board">
      <summary className="eyebrow">
        {t("seeAll", { count: inPlay(states).length })}
      </summary>
      <p className="legend hint" aria-hidden="true">
        <span>
          <i className="likely" /> {t("legendLikely")}
        </span>
        <span>
          <i className="check" /> {t("legendCheck")}
        </span>
        <span>
          <i className="unlock" /> {t("legendUnlock")}
        </span>
        <span>
          <i className="have" /> {t("legendHave")}
        </span>
      </p>
      <div className="areas">
        {areas.map((a) => {
          const counts = SHOWN.map(
            (k) => [k, a.list.filter((s) => status(s) === k).length] as const,
          ).filter(([, n]) => n);
          return (
            <details key={a.t} className="area" data-testid={`area-${a.t}`}>
              <summary>
                <span className="area-name">
                  {tt.has(a.t as "home") ? tt(a.t as "home") : a.name}
                </span>
                <span className="dots" aria-hidden="true">
                  {a.list.map((s) => (
                    <i
                      key={s.id}
                      className={`${status(s)}${changed.includes(s.id) ? " flash" : ""}`}
                    />
                  ))}
                </span>
                <span className="area-count">
                  {counts.length
                    ? counts
                        .map(([k, n]) =>
                          t(COUNT_KEY[k as keyof typeof COUNT_KEY], {
                            count: n,
                          }),
                        )
                        .join(" · ")
                    : a.list.some((s) => status(s) === "open")
                      ? t("toCheck", {
                          count: a.list.filter((s) => status(s) === "open")
                            .length,
                        })
                      : t("noneFit")}
                </span>
              </summary>
              <div className="tiles">
                {/* What doesn't apply is listed with reasons under the results, so rows keep only what's live. */}
                {a.list
                  .filter((s) => status(s) !== "out")
                  .map((s) => {
                    const st = status(s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`tile ${st}${changed.includes(s.id) ? " flash" : ""}`}
                        onClick={() => select(s.id)}
                        data-testid={`scheme-${s.id}`}
                        data-status={st}
                        title={`${s.name}: ${statusText(st)}`}
                      >
                        <i aria-hidden="true" />
                        {s.name}
                        <span className="sr-only">: {statusText(st)}</span>
                      </button>
                    );
                  })}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
