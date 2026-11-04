import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { getCountry, getLocale, getT } from "@/i18n/server";
import "../marketing.css";
import { Icon } from "@/components/Icon";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Pipeline } from "@/components/marketing/Pipeline";
import { Reveal } from "@/components/marketing/Reveal";
import { SectionHead } from "@/components/marketing/SectionHead";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { StepsRail } from "@/components/marketing/StepsRail";
import { Ticker } from "@/components/marketing/Ticker";
import { SiteFooter } from "@/components/SiteFooter";
import COUNTS from "@/data/data-counts.json";
import { COVERED_NATIONS, SCHEMES, schemesOf, topicsOf } from "@/engine/rules";
import { flagOf } from "@/i18n/countries";
import { intlTag, LOCALES } from "@/i18n/locales";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("meta.howTitle"), description: t("meta.howDesc") };
}

// Model names and ids are official names, so they stay in English; each job lives in messages.
const MODELS = [
  ["Muse Spark 1.3", "muse-spark-1.3", "spark"],
  ["Muse Wonder", "muse-wonder-1.0", "wonder"],
  ["Muse Spark Open", "muse-spark-open-1026", "open"],
  ["Muse Voice Transcribe", "muse-voice-transcribe-1.0", "voice"],
  ["SAM 3.1", "sam-3.1", "sam"],
  ["Muse Image", "muse-image-1.0", "image"],
] as const;

const RULES = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;

// Live numbers from the packs and data builders.
const STATS = [
  ["schemes", SCHEMES.length],
  ["countries", 2],
  ["languages", LOCALES.length],
  ["councilPages", COUNTS.councilLinks.links],
  ["charities", COUNTS.charityFunds.funds],
  [
    "usPlaces",
    COUNTS.usLocal.centers +
      COUNTS.usLocal.agencies +
      COUNTS.usLocal.counselors,
  ],
] as const;

export default async function How() {
  const t = await getT();
  const locale = await getLocale();
  // The person's own country leads the coverage list.
  const order =
    (await getCountry()) === "US"
      ? (["US", "GB"] as const)
      : (["GB", "US"] as const);
  const nations = new Intl.ListFormat(intlTag(locale), {
    type: "conjunction",
  }).format(COVERED_NATIONS.map((n) => t(`nations.${n}`)));
  const flow = [
    {
      lane: t("how.lanes.you"),
      icon: "person",
      items: [
        { t: t("how.items.type.title"), d: t("how.items.type.text") },
        { t: t("how.items.speak.title"), d: t("how.items.speak.text") },
        { t: t("how.items.snap.title"), d: t("how.items.snap.text") },
        { t: t("how.items.answer.title"), d: t("how.items.answer.text") },
      ],
    },
    {
      lane: t("how.lanes.read"),
      icon: "doc",
      items: [
        { t: "Muse Voice Transcribe", d: t("how.items.transcribe.text") },
        { t: "SAM 3.1", d: t("how.items.sam.text") },
        { t: t("how.items.reader.title"), d: t("how.items.reader.text") },
        { t: t("how.items.agent.title"), d: t("how.items.agent.text") },
      ],
    },
    {
      lane: t("how.lanes.code"),
      icon: "shield",
      items: [
        { t: t("how.items.validate.title"), d: t("how.items.validate.text") },
        {
          t: t("how.items.engine.title"),
          d: t("how.items.engine.text", { count: SCHEMES.length }),
        },
        { t: t("how.items.planner.title"), d: t("how.items.planner.text") },
        { t: t("how.items.chains.title"), d: t("how.items.chains.text") },
      ],
    },
    {
      lane: t("how.lanes.get"),
      icon: "spark",
      items: [
        { t: t("how.items.results.title"), d: t("how.items.results.text") },
        { t: t("how.items.plan.title"), d: t("how.items.plan.text") },
        { t: t("how.items.say.title"), d: t("how.items.say.text") },
        { t: t("how.items.picture.title"), d: t("how.items.picture.text") },
      ],
    },
  ];
  return (
    <PageTransition>
      <div className="site mk-page">
        <SiteHeader current="how" />
        <main id="main">
          <section className="mk-wrap mk-howhero" aria-labelledby="how-h">
            <span className="mk-tag">{t("how.tag")}</span>
            <h1 id="how-h">{t("how.h1")}</h1>
            <p className="mk-lead">{t("how.lead")}</p>
            <dl className="mk-stats">
              {STATS.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(`how.stats.${label}`)}</dt>
                  <dd>
                    <Ticker value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="flow-h">
            <Reveal>
              <SectionHead
                tag={t("how.flow.tag")}
                id="flow-h"
                title={t("how.flow.title")}
              >
                {t("how.flow.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <Pipeline lanes={flow} />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="loop-h">
            <Reveal>
              <SectionHead
                tag={t("how.loop.tag")}
                id="loop-h"
                title={t("how.loop.title")}
              >
                {t("how.loop.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <StepsRail />
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="models-h">
            <Reveal>
              <SectionHead
                tag={t("how.models.tag")}
                id="models-h"
                title={t("how.models.title")}
              >
                {t("how.models.lead")}
              </SectionHead>
            </Reveal>
            <Reveal>
              <ul className="mk-models">
                {MODELS.map(([n, id, job]) => (
                  <li key={id}>
                    <div className="mk-model-top">
                      <b>{n}</b>
                      <code>{id}</code>
                    </div>
                    <span>{t(`how.models.jobs.${job}`)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="rules-h">
            <div className="mk-rules">
              <Reveal>
                <SectionHead
                  tag={t("how.rules.tag")}
                  id="rules-h"
                  title={t("how.rules.title")}
                >
                  {t("how.rules.lead")}
                </SectionHead>
              </Reveal>
              <Reveal>
                <ol className="mk-ledger">
                  {RULES.map((r, i) => (
                    <li key={r}>
                      <span className="n">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{t(`how.rules.list.${r}`)}</span>
                      <Icon name="check" size={18} />
                    </li>
                  ))}
                </ol>
              </Reveal>
            </div>
          </section>

          <section className="mk-wrap mk-section" aria-labelledby="cover-h">
            <Reveal>
              <SectionHead
                tag={t("how.cover.tag")}
                id="cover-h"
                title={t("how.cover.title")}
              >
                {t("how.cover.leadAll", { schemes: SCHEMES.length, nations })}
              </SectionHead>
            </Reveal>
            {order.map((c) => (
              <Reveal key={c}>
                <h3 className="mk-cover-country">
                  <span aria-hidden="true">{flagOf(c)}</span>{" "}
                  {t(c === "GB" ? "how.cover.uk" : "how.cover.us", {
                    schemes: schemesOf(c).length,
                    topics: topicsOf(c).length,
                  })}
                </h3>
                <div className="mk-topics">
                  {topicsOf(c).map(([topic, name]) => {
                    const list = SCHEMES.filter(
                      (s) => s.topic === topic && s.country === c,
                    );
                    const key = `topics.${topic}` as "topics.home";
                    return (
                      <div key={topic} className="mk-topic">
                        <div className="mk-topic-top">
                          <b>{t.has(key) ? t(key) : name}</b>
                          <span className="mk-count">{list.length}</span>
                        </div>
                        <ul>
                          {list.map((s) => (
                            <li key={s.id}>{s.name}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            ))}
          </section>

          <FinalCta title={t("how.ctaTitle")} text={t("how.ctaText")} />
        </main>
        <SiteFooter />
      </div>
    </PageTransition>
  );
}
