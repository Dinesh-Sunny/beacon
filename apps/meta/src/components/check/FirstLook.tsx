"use client";

// The canvas before the first answer. Names real help people know, says how much more is checked,
// and points at what's different: each result comes with the official rule behind it.

import { useTranslations } from "use-intl";
import { byId, GATEWAYS, schemesOf } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

/** Help people already know by name, per country: the US names its gateway programs. */
const NAMED: Record<string, string[]> = { GB: ["pc", "ctr"] };

export function FirstLook({ onExample }: { onExample: () => void }) {
  const t = useTranslations("first");
  const country = useCheck().answers.country ?? "GB";
  const all = schemesOf(country);
  const named =
    NAMED[country] ??
    GATEWAYS.filter((g) => byId[g]?.country === country).slice(0, 2);
  const names = named.map((id) => byId[id]?.name).filter(Boolean);
  return (
    <section
      className="first-look"
      aria-labelledby="fl-h"
      data-testid="first-look"
    >
      {/* The Beacon Framework in one line: you on one side, everyone who gives help on the other. */}
      <div className="fl-map" role="img" aria-label={t("mapLabel")}>
        <span className="fl-end">{t("you")}</span>
        <i className="fl-beam" />
        <div className="lamp" aria-hidden="true">
          <i />
          <i />
          <i />
          <span />
        </div>
        <i className="fl-beam out" />
        <span className="fl-end">{t("givers")}</span>
      </div>
      <h2 id="fl-h">
        {t("headline", {
          names: names.join(", "),
          more: all.length - names.length,
        })}
      </h2>
      <p className="fl-lead">
        {t("lead")}{" "}
        <button type="button" className="linkbtn" onClick={onExample}>
          {t("example")}
        </button>
      </p>
    </section>
  );
}
