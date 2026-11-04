import Link from "next/link";
import { Icon } from "@/components/Icon";

export function FinalCta({ title, text }: { title: string; text: string }) {
  return (
    <section className="mk-wrap mk-section" aria-labelledby="cta-h">
      <div className="mk-cta">
        <div className="mk-cta-glow" aria-hidden="true" />
        <h2 id="cta-h">{title}</h2>
        <p className="mk-lead">{text}</p>
        <Link href="/check" className="btn mk-cta-btn">
          Start a check <Icon name="arrow" size={18} />
        </Link>
        <ul className="mk-cta-facts">
          <li>
            <Icon name="lock" size={18} /> Answers stay in your browser
          </li>
          <li>
            <Icon name="shield" size={18} /> No name, National Insurance number or bank details
          </li>
          <li>
            <Icon name="check" size={18} /> Free to use
          </li>
        </ul>
      </div>
    </section>
  );
}
