import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getCountry, getT } from "@/i18n/server";

export async function FinalCta({
  title,
  text,
}: {
  title?: string;
  text?: string;
}) {
  const t = await getT();
  const us = (await getCountry()) === "US";
  return (
    <section className="mk-wrap mk-section" aria-labelledby="cta-h">
      <div className="mk-cta">
        <h2 id="cta-h">{title ?? t("site.ctaTitle")}</h2>
        <p className="mk-lead">{text ?? t("site.ctaText")}</p>
        <Link
          href="/check"
          className="btn mk-cta-btn"
          transitionTypes={["nav-forward"]}
        >
          {t("site.start")} <Icon name="arrow" size={18} />
        </Link>
        <ul className="mk-cta-facts">
          <li>
            <Icon name="lock" size={18} /> {t("site.factBrowser")}
          </li>
          <li>
            <Icon name="shield" size={18} />{" "}
            {t(us ? "site.factNoIdUs" : "site.factNoId")}
          </li>
          <li>
            <Icon name="check" size={18} /> {t("site.factFree")}
          </li>
        </ul>
      </div>
    </section>
  );
}
