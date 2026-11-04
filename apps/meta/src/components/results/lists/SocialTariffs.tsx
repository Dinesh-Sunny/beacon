"use client";

// The cheapest social tariffs on Ofcom's list that cover the person's whole nation, read by the
// Ofcom connector. Three show; the rest wait behind one button.

import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import data from "@/data/social-tariffs.json";
import type { Nation } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

export function SocialTariffs({ nation }: { nation: Nation | null }) {
  const [all, setAll] = useState(false);
  const { subject } = useCheck();
  const t = useTranslations("lists");
  const fmt = useFormatter();
  const readOn = fmt.dateTime(new Date(data.read), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const list = data.tariffs.filter(
    (t) => !nation || t.nations.includes(nation),
  );
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 3);
  return (
    <div className="mini-list">
      <span className="eyebrow">
        {subject.who === "me" ? t("cheapest") : t("cheapestThey")}
      </span>
      <ul>
        {shown.map((t) => (
          <li key={t.package}>
            <span>{t.package}</span>
            <span className="hint">{t.speed}</span>
            <b>£{t.monthly.toFixed(t.monthly % 1 ? 2 : 0)}</b>
          </li>
        ))}
      </ul>
      <p className="hint">
        {t.rich("tariffNote", {
          date: readOn,
          link: (c) => (
            <a href={data.source} target="_blank" rel="noreferrer">
              {c}
            </a>
          ),
        })}{" "}
        {list.length > 3 && (
          <button
            type="button"
            className="linkbtn"
            onClick={() => setAll((a) => !a)}
            aria-expanded={all}
          >
            {all ? t("fewer") : t("all", { count: list.length })}
          </button>
        )}
      </p>
    </div>
  );
}
