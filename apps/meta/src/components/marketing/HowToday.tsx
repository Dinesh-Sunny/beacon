import { Icon } from "@/components/Icon";

// Bento of how a check works today. Each card draws a small piece of the real UI in CSS.
export function HowToday() {
  return (
    <div className="mk-bento">
      <article className="mk-card wide">
        <div className="mk-card-art mk-art-ways" aria-hidden="true">
          <div className="way">
            <Icon name="chat" size={22} />
            <span>Type</span>
          </div>
          <div className="way">
            <Icon name="mic" size={22} />
            <span>Speak</span>
          </div>
          <div className="way letter">
            <Icon name="camera" size={22} />
            <span>Snap a letter</span>
            <div className="paper">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <h3>Type, speak or snap a letter</h3>
        <p>
          Write in your own words. Or talk, and Muse Voice Transcribe writes it
          down. Or take a photo of a letter: SAM 3.1 finds the page and Muse
          Spark reads it.
        </p>
      </article>

      <article className="mk-card wide">
        <div className="mk-card-art mk-art-results" aria-hidden="true">
          <div className="mk-row likely on">
            <span>Pension Credit</span>
            <em>Likely</em>
          </div>
          <div className="mk-row check on">
            <span>Council Tax Reduction</span>
            <em>Worth checking</em>
          </div>
          <div className="mk-row unlock on">
            <span>Cold Weather Payment</span>
            <em>Unlocks next</em>
          </div>
        </div>
        <h3>Results light up as you answer</h3>
        <p>
          Likely, worth checking, or unlocks next. Each one shows the conditions
          behind it and links to the official page.
        </p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-ask" aria-hidden="true">
          <p className="mk-bubble beacon on">
            Do you live in England, Scotland or Wales?
          </p>
        </div>
        <h3>One small question at a time</h3>
        <p>Beacon only asks what could still change a result.</p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-warn" aria-hidden="true">
          <Icon name="warn" size={20} />
          <span>
            Claiming this could lower another payment. Read this first.
          </span>
        </div>
        <h3>A warning before you claim</h3>
        <p>
          If one claim could lower another, you hear about it first, in plain
          words.
        </p>
      </article>

      <article className="mk-card">
        <div className="mk-card-art mk-art-call" aria-hidden="true">
          <span className="n">1</span>
          <span className="n">2</span>
          <span className="n">3</span>
          <span className="phone">
            <Icon name="phone" size={18} /> What to say
          </span>
        </div>
        <h3>Claims in order, with what to say</h3>
        <p>
          Beacon puts your claims in the right order and writes notes for each
          phone call.
        </p>
      </article>

      <article className="mk-card full split">
        <div>
          <h3>Code decides every result</h3>
          <p>
            Plain code checks the official rules, so the same answers always
            give the same result. Meta's models listen, read and explain. Your
            answers stay in your browser.
          </p>
        </div>
        <ul className="mk-chips" aria-label="Meta models in Beacon">
          <li>Muse Spark</li>
          <li>Muse Voice Transcribe</li>
          <li>SAM 3.1</li>
          <li>Muse Image</li>
        </ul>
      </article>
    </div>
  );
}
