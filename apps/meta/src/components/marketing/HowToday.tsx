import { Icon } from "@/components/Icon";
import { getT } from "@/i18n/server";

// Bento of how a check works today. Each card draws a small piece of the real UI in CSS.
// Scheme and model names are official names, so they stay in English.
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
        <div className="mk-card-art mk-art-results" aria-hidden="true">
          <div className="mk-row likely on">
            <span>Pension Credit</span>
            <em>{t("status.likely")}</em>
          </div>
          <div className="mk-row check on">
            <span>Council Tax Reduction</span>
            <em>{t("status.check")}</em>
          </div>
          <div className="mk-row unlock on">
            <span>Cold Weather Payment</span>
            <em>{t("status.unlock")}</em>
          </div>
        </div>
        <h3>{t("home.today.resultsTitle")}</h3>
        <p>{t("home.today.resultsText")}</p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-ask" aria-hidden="true">
          <p className="mk-bubble beacon on">{t("home.today.askBubble")}</p>
        </div>
        <h3>{t("home.today.askTitle")}</h3>
        <p>{t("home.today.askText")}</p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-warn" aria-hidden="true">
          <Icon name="warn" size={20} />
          <span>{t("home.today.warnArt")}</span>
        </div>
        <h3>{t("home.today.warnTitle")}</h3>
        <p>{t("home.today.warnText")}</p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-call" aria-hidden="true">
          <span className="n">1</span>
          <span className="n">2</span>
          <span className="n">3</span>
          <span className="phone">
            <Icon name="phone" size={18} /> {t("home.today.callArt")}
          </span>
        </div>
        <h3>{t("home.today.orderTitle")}</h3>
        <p>{t("home.today.orderText")}</p>
      </article>

      <article className="mk-card full split">
        <div>
          <h3>{t("home.today.codeTitle")}</h3>
          <p>{t("home.today.codeText")}</p>
        </div>
        <ul className="mk-chips" aria-label={t("home.today.chipsLabel")}>
          <li>Muse Spark</li>
          <li>Muse Voice Transcribe</li>
          <li>SAM 3.1</li>
          <li>Muse Image</li>
        </ul>
      </article>
    </div>
  );
}
