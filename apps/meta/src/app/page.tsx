import type { Metadata } from "next";
import "./marketing.css";
import { HomeStart } from "@/components/home/HomeStart";
import { SiteFooter } from "@/components/SiteFooter";
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
import { SCHEMES, TOPICS } from "@/engine/rules";

export const metadata: Metadata = { title: { absolute: "Beacon - find the support that's already yours" } };

export default function Home() {
  return (
    <div className="site mk-page">
      <SiteHeader />

      <main>
        <section className="mk-wrap mk-hero" aria-labelledby="hero-h">
          <div className="mk-hero-copy">
            <p className="mk-pill">
              <span className="dot" aria-hidden="true" /> Free · {SCHEMES.length} kinds of help · England, Scotland and Wales
            </p>
            <h1 id="hero-h">Find the support that's already yours.</h1>
            <p className="mk-lead">
              Tell Beacon about your life, or the life of someone you look after. It shows the help that's likely yours and gets you
              ready to claim it.
            </p>
            <HomeStart />
          </div>
          <ChatDemo />
        </section>

        <section className="mk-wrap mk-stat" aria-label="Support waiting to be claimed">
          <Reveal className="mk-stat-in">
            <p className="mk-stat-num">
              <Ticker value={24.1} decimals={1} prefix="£" suffix="bn" />
              <span>a year</span>
            </p>
            <p className="mk-stat-text">
              That's how much income-related support and social tariffs goes unclaimed in Great Britain each year. Beacon helps you
              find your share.{" "}
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Policy in Practice, Missing Out 2025
              </a>
            </p>
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="frame-h">
          <Reveal>
            <SectionHead tag="The Beacon Framework" id="frame-h" title="Everyone who needs help, meet everyone who gives it" center>
              People on one side. Government, councils, the NHS, charities, utility companies and employers on the other. Beacon's
              agents connect the two.
            </SectionHead>
          </Reveal>
          <Reveal>
            <BeaconMap />
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="steps-h">
          <Reveal>
            <SectionHead tag="Eight steps" id="steps-h" title="The same eight steps for every person">
              The first four work today. The other four are where Beacon is going.
            </SectionHead>
          </Reveal>
          <Reveal>
            <StepsRail />
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="today-h">
          <Reveal>
            <SectionHead tag="How it works today" id="today-h" title="It starts with a chat">
              Tell Beacon what's going on, in your own words. It asks one small question at a time and shows results as you answer.
            </SectionHead>
          </Reveal>
          <Reveal>
            <HowToday />
          </Reveal>
        </section>

        <section className="mk-section mk-cover" aria-labelledby="cover-h">
          <div className="mk-wrap">
            <Reveal>
              <SectionHead tag="What it checks today" id="cover-h" title={`${SCHEMES.length} kinds of help across ${TOPICS.length} areas of life`} center>
                From Pension Credit to Healthy Start, in England, Scotland and Wales.
              </SectionHead>
            </Reveal>
          </div>
          <SchemeMarquee />
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="grow-h">
          <Reveal>
            <SectionHead tag="Where it's going" id="grow-h" title="From one family to a worldwide network" />
          </Reveal>
          <Reveal>
            <Growth />
          </Reveal>
          <Reveal>
            <Plans />
          </Reveal>
        </section>

        <FinalCta title="Check for yourself, or for someone you love" text="Start with a few words about the person. Beacon asks the rest, one small question at a time." />
      </main>
      <SiteFooter />
    </div>
  );
}
