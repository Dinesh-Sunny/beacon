"use client";

// The canvas before the first answer. Names real help people know, says how much more is checked,
// and points at what's different: each result comes with the official rule behind it.

import { useTranslations } from "use-intl";
import { byId, SCHEMES } from "@/engine/rules";

const NAMED = ["pc", "ctr"];

export function FirstLook({ onExample }: { onExample: () => void }) {
  const t = useTranslations("first");
  const names = NAMED.map((id) => byId[id]?.name).filter(Boolean);
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
          more: SCHEMES.length - names.length,
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
