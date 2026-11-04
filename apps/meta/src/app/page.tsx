import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import "./marketing.css";
import { HomeStart } from "@/components/home/HomeStart";
import { Icon } from "@/components/Icon";
import { BeaconMap } from "@/components/marketing/BeaconMap";
import { Countries } from "@/components/marketing/Countries";
import { SOURCE_URL, SOURCE_URL_US } from "@/components/marketing/content";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Growth, Plans } from "@/components/marketing/Growth";
import { HeroBeams } from "@/components/marketing/HeroBeams";
import { HeroWindow } from "@/components/marketing/HeroWindow";
import { HowToday } from "@/components/marketing/HowToday";
import { Reveal } from "@/components/marketing/Reveal";
import { SchemeMarquee } from "@/components/marketing/SchemeMarquee";
import { SectionHead } from "@/components/marketing/SectionHead";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { StepsRail } from "@/components/marketing/StepsRail";
import { Ticker } from "@/components/marketing/Ticker";
import { SiteFooter } from "@/components/SiteFooter";
import COUNTS from "@/data/data-counts.json";
import { COVERED_NATIONS, SCHEMES, schemesOf } from "@/engine/rules";
import { intlTag, LOCALES } from "@/i18n/locales";
import { getCountry, getLocale, getT } from "@/i18n/server";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { absolute: t("meta.homeTitle") },
    description: t("meta.homeDesc"),
    openGraph: { title: t("meta.homeTitle"), description: t("meta.homeDesc") },
  };
}

export default async function Home() {
  const t = await getT();
  const locale = await getLocale();
  // The numbers, example and stat follow the country the person chose in the place picker.
  const country = await getCountry();
  const us = country === "US";
  const nations = new Intl.ListFormat(intlTag(locale), {
    type: "conjunction",
  }).format(COVERED_NATIONS.map((n) => t(`nations.${n}`)));
  return (
    <PageTransition>
      <div className="site mk-page">
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own constants, with < escaped
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Beacon",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Any",
              isAccessibleForFree: true,
              inLanguage: LOCALES.map((l) => l.code),
              areaServed: ["GB", "US"],
              description: t("meta.homeDesc"),
              url: SITE_URL,
            }).replace(/</g, "\\u003c"),
          }}
        />
        <SiteHeader />

        <main id="main">
          <section className="mk-hero" aria-labelledby="hero-h">
            <div className="hx-panel">
              <HeroBeams />
              <div className="mk-wrap mk-hero-copy">
                <p className="mk-pill">
                  <span className="dot" aria-hidden="true" />{" "}
                  {t("site.pillCountry", {
                    count: schemesOf(country).length,
                    country: t(
                      us ? "home.countries.us.name" : "home.countries.uk.name",
                    ),
                    languages: LOCALES.length,
                  })}
                </p>
                <h1 id="hero-h">{t("site.h1")}</h1>
                <p className="mk-lead">{t("site.lead")}</p>
                <HomeStart country={country} />
                <ul className="mk-trust">
                  <li>
                    <Icon name="lock" size={16} /> {t("site.factBrowser")}
                  </li>
                  <li>
                    <Icon name="shield" size={16} /> {t("site.factNoIdShort")}
                  </li>
                  <li>
                    <Icon name="spark" size={16} /> {t("site.factFree")}
                  </li>
                </ul>
              </div>
            </div>
            <div className="mk-wrap hx-window">
              <HeroWindow country={country} />
            </div>
          </section>

          <section className="mk-wrap mk-stat" aria-label={t("home.statLabel")}>
            <Reveal className="mk-stat-in">
              {us ? (
                <>
                  <p className="mk-stat-num">{t("home.statUs.num")}</p>
                  <p className="mk-stat-text">
                    {t("home.statUs.text")}{" "}
                    <a href={SOURCE_URL_US} target="_blank" rel="noreferrer">
                      {t("home.statUs.source")}
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="mk-stat-num">
                    <Ticker
                      value={24.1}
                      decimals={1}
                      prefix="£"
                      suffix={t("home.statUnit")}
                    />
                    <span>{t("site.perYear")}</span>
                  </p>
                  <p className="mk-stat-text">
                    {t("site.statText")}{" "}
                    <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                      Policy in Practice, Missing Out 2025
                    </a>
                  </p>
                </>
              )}
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="frame-h">
            <Reveal>
              <SectionHead
                tag={t("home.frame.tag")}
                id="frame-h"
                title={t("home.frame.title")}
                center
              >
                {t("home.frame.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <BeaconMap />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="steps-h">
            <Reveal>
              <SectionHead
                tag={t("home.steps.tag")}
                id="steps-h"
                title={t("home.steps.title")}
              >
                {t("home.steps.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <StepsRail />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="today-h">
            <Reveal>
              <SectionHead
                tag={t("home.todayHead.tag")}
                id="today-h"
                title={t("home.todayHead.title")}
              >
                {t("home.todayHead.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <HowToday />
            </Reveal>
          </section>

          <section className="mk-section mk-cover" aria-labelledby="cover-h">
            <div className="mk-wrap">
              <Reveal>
                <SectionHead
                  tag={t("home.cover.tag")}
                  id="cover-h"
                  title={t("home.cover.titleAll", {
                    schemes: SCHEMES.length,
                    countries: 2,
                  })}
                  center
                >
                  {t("home.cover.leadAll", {
                    nations,
                    places:
                      COUNTS.councilLinks.links +
                      COUNTS.charityFunds.funds +
                      COUNTS.usLocal.centers +
                      COUNTS.usLocal.agencies +
                      COUNTS.usLocal.counselors,
                  })}
                </SectionHead>
              </Reveal>
              <Reveal>
                <Countries first={country} />
              </Reveal>
            </div>
            <SchemeMarquee />
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="grow-h">
            <Reveal>
              <SectionHead
                tag={t("home.grow.tag")}
                id="grow-h"
                title={t("home.grow.title")}
              />
            </Reveal>
            <Reveal>
              <Growth />
            </Reveal>
            <Reveal>
              <Plans />
            </Reveal>
          </section>

          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </PageTransition>
  );
}
