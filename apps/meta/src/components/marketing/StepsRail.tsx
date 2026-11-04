import { getT } from "@/i18n/server";
import { LOOP } from "./content";

// The eight steps every person goes through. Solid amber = live today, dashed = where it's going.
// The legend only shows the "where it's going" half while some step is still to come.
export async function StepsRail() {
  const t = await getT();
  const coming = LOOP.some((s) => !s.live);
  return (
    <div className="mk-rail">
      <div className="mk-rail-groups" aria-hidden="true">
        <span className="live">{t("home.rail.live")}</span>
        {coming && <span>{t("home.rail.coming")}</span>}
      </div>
      <ol>
        {LOOP.map((s, i) => (
          <li key={s.id} className={s.live ? "live" : ""}>
            <span className="mk-rail-dot">{i + 1}</span>
            <b>{t(`home.loop.${s.id}.title`)}</b>
            <span className="mk-rail-d">{t(`home.loop.${s.id}.text`)}</span>
            <span className="sr-only">
              {s.live ? t("home.rail.liveSr") : t("home.rail.comingSr")}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
