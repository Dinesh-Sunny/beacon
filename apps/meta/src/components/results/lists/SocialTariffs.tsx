"use client";

// The cheapest social tariffs on Ofcom's list that cover the person's whole nation, read by the
// Ofcom connector. Three show; the rest wait behind one button.

import { useState } from "react";
import data from "@/data/social-tariffs.json";
import type { Nation } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

const readOn = new Date(data.read).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function SocialTariffs({ nation }: { nation: Nation | null }) {
  const [all, setAll] = useState(false);
  const { subject } = useCheck();
  const list = data.tariffs.filter(
    (t) => !nation || t.nations.includes(nation),
  );
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 3);
  return (
    <div className="mini-list">
      <span className="eyebrow">
        Cheapest where {subject.who === "me" ? "you live" : "they live"}
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
        A month, from{" "}
        <a href={data.source} target="_blank" rel="noreferrer">
          Ofcom's list
        </a>{" "}
        read on {readOn}.{" "}
        {list.length > 3 && (
          <button
            type="button"
            className="linkbtn"
            onClick={() => setAll((a) => !a)}
            aria-expanded={all}
          >
            {all ? "Show fewer" : `All ${list.length}`}
          </button>
        )}
      </p>
    </div>
  );
}
