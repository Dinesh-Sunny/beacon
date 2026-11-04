import { getT } from "@/i18n/server";

// Where Beacon grows: rings spreading out from the lamp, then the plans and the promise.

const STAGES = [
  { id: "people", now: true },
  { id: "countries", now: true },
  { id: "orgs", now: false },
  { id: "network", now: false },
] as const;

const PLANS = [
  { id: "free", today: true },
  { id: "pro", today: false },
  { id: "funded", today: false },
] as const;

export async function Growth() {
  const t = await getT();
  return (
    <div className="mk-grow">
      <div className="mk-rings" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s.id} className={`ring r${i}`} />
        ))}
        <span className="core" />
      </div>
      <ol className="mk-stages">
        {STAGES.map((s, i) => (
          <li key={s.id} className={s.now ? "now" : ""}>
            <span className="mk-stage-n">
              {s.now ? t("home.growth.now") : `0${i + 1}`}
            </span>
            <div>
              <b>{t(`home.growth.stages.${s.id}.title`)}</b>
              <span>{t(`home.growth.stages.${s.id}.text`)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export async function Plans() {
  const t = await getT();
  return (
    <div className="mk-plans-wrap">
      <ul className="mk-plans">
        {PLANS.map((p) => (
          <li key={p.id} className={p.today ? "today" : ""}>
            <span className="mk-plan-when">
              {p.today ? t("home.growth.today") : t("home.growth.planned")}
            </span>
            <b>{t(`home.growth.plans.${p.id}.title`)}</b>
            <span>{t(`home.growth.plans.${p.id}.text`)}</span>
          </li>
        ))}
      </ul>
      <p className="mk-promise">{t("home.growth.promise")}</p>
    </div>
  );
}
