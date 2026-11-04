import { Icon } from "@/components/Icon";
import { LOCALES } from "@/i18n/locales";
import { getT } from "@/i18n/server";

// Bento of how a check works today. Each card draws a small piece of the real UI in CSS.
// Scheme and model names are official names, so they stay in English.
// Each language's own name for itself, as the language picker shows it.
const LANGS = LOCALES.map((l) => l.name);

export async function HowToday() {
  const t = await getT();
  return (
    <div className="mk-bento">
      <article className="mk-card wide">
        <div className="mk-card-art mk-art-ways" aria-hidden="true">
          <div className="way">
            <Icon name="chat" size={22} />
            <span>{t("home.today.type")}</span>
          </div>
          <div className="way">
            <Icon name="mic" size={22} />
            <span>{t("home.today.speak")}</span>
          </div>
          <div className="way letter">
            <Icon name="camera" size={22} />
            <span>{t("home.today.snap")}</span>
            <div className="paper">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <h3>{t("home.today.waysTitle")}</h3>
        <p>{t("home.today.waysText")}</p>
      </article>

      <article className="mk-card wide">
        <div className="mk-card-art mk-art-langs" aria-hidden="true">
          <div className="mk-langs">
            {LANGS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <div className="mk-aa">
            <span className="s">Aa</span>
            <span className="m">Aa</span>
            <span className="l">Aa</span>
            <Icon name="speaker" size={18} />
          </div>
        </div>
        <h3>{t("home.today.langTitle")}</h3>
        <p>{t("home.today.langText")}</p>
      </article>
    </div>
  );
}

/** The model chips for the "Under the hood" card at the foot of the home page. */
export async function CodeCard() {
  const t = await getT();
  return (
    <article className="mk-card full split">
      <div>
        <h3>{t("home.today.codeTitle")}</h3>
        <p>{t("home.today.codeText")}</p>
      </div>
      <ul className="mk-chips" aria-label={t("home.today.chipsLabel")}>
        <li>Muse Spark</li>
        <li>Muse Wonder</li>
        <li>Muse Voice Transcribe</li>
        <li>SAM 3.1</li>
        <li>Muse Image</li>
        <li>Muse Spark Open</li>
      </ul>
    </article>
  );
}
