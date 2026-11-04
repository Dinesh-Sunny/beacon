import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import "./marketing.css";
import { HomeStart } from "@/components/home/HomeStart";
import { BeaconMap } from "@/components/marketing/BeaconMap";
import { ChatDemo } from "@/components/marketing/ChatDemo";
import { SOURCE_URL } from "@/components/marketing/content";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Growth, Plans } from "@/components/marketing/Growth";
import { HowToday } from "@/components/marketing/HowToday";
import { Reveal } from "@/components/marketing/Reveal";
import { SchemeMarquee } from "@/components/marketing/SchemeMarquee";
import { SectionHead } from "@/components/marketing/SectionHead";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { StepsRail } from "@/components/marketing/StepsRail";
import { Ticker } from "@/components/marketing/Ticker";
import { SiteFooter } from "@/components/SiteFooter";
import COUNTS from "@/data/data-counts.json";
import { COVERED_NATIONS, SCHEMES, TOPICS } from "@/engine/rules";
import { intlTag } from "@/i18n/locales";
import { getLocale, getT } from "@/i18n/server";
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
              inLanguage: ["en", "cy", "pl", "es", "bn", "ur", "ar"],
              description: t("meta.homeDesc"),
              url: SITE_URL,
            }).replace(/</g, "\\u003c"),
          }}
        />
        <SiteHeader />

        <main id="main">
          <section className="mk-wrap mk-hero" aria-labelledby="hero-h">
            <div className="mk-hero-copy">
              <p className="mk-pill">
                <span className="dot" aria-hidden="true" />{" "}
                {t("site.pill", { count: SCHEMES.length, nations })}
              </p>
              <h1 id="hero-h">{t("site.h1")}</h1>
              <p className="mk-lead">{t("site.lead")}</p>
              <HomeStart />
            </div>
            <ChatDemo />
          </section>

          <section
            className="mk-wrap mk-stat"
            aria-label="Support waiting to be claimed"
          >
            <Reveal className="mk-stat-in">
              <p className="mk-stat-num">
                <Ticker value={24.1} decimals={1} prefix="£" suffix="bn" />
                <span>{t("site.perYear")}</span>
              </p>
              <p className="mk-stat-text">
                {t("site.statText")}{" "}
                <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                  Policy in Practice, Missing Out 2025
                </a>
              </p>
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="frame-h">
            <Reveal>
              <SectionHead
                tag="The Beacon Framework"
                id="frame-h"
                title="Everyone who needs help, meet everyone who gives it"
                center
              >
                People on one side. Government, councils, the NHS, charities,
                utility companies and employers on the other. Beacon's agents
                connect the two.
              </SectionHead>
            </Reveal>
            <Reveal>
              <BeaconMap />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="steps-h">
            <Reveal>
              <SectionHead
                tag="Eight steps"
                id="steps-h"
                title="The same eight steps for every person"
              >
                All eight work today, in your browser.
              </SectionHead>
            </Reveal>
            <Reveal>
              <StepsRail />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="today-h">
            <Reveal>
              <SectionHead
                tag="How it works today"
                id="today-h"
                title="It starts with a chat"
              >
                Tell Beacon what's going on, in your own words. It asks one
                small question at a time and shows results as you answer.
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
                  tag="What it checks today"
                  id="cover-h"
                  title={`${SCHEMES.length} kinds of help across ${TOPICS.length} areas of life`}
                  center
                >
                  From Pension Credit to Healthy Start, in {nations}. Plus{" "}
                  {COUNTS.councilLinks.links.toLocaleString("en-GB")} council
                  pages and {COUNTS.charityFunds.funds.toLocaleString("en-GB")}{" "}
                  grant-giving charities, matched to your postcode.
                </SectionHead>
              </Reveal>
            </div>
            <SchemeMarquee />
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="grow-h">
            <Reveal>
              <SectionHead
                tag="Where it's going"
                id="grow-h"
                title="From one family to a worldwide network"
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
