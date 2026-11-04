import type { Metadata } from "next";
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
import {
  COVERED_NATIONS,
  COVERED_NATIONS_TXT,
  SCHEMES,
  TOPICS,
} from "@/engine/rules";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Beacon's agents turn a chat, a voice note or a photo of a letter into a checked list of support and a plan to claim it.",
};

const FLOW = [
  {
    lane: "You",
    icon: "person",
    items: [
      { t: "Type", d: "Plain words in the chat" },
      { t: "Speak", d: "Recorded in your browser" },
      { t: "Snap a letter", d: "Shrunk and stripped of photo data first" },
      { t: "Answer a question", d: "The right input for each fact" },
    ],
  },
  {
    lane: "Meta models read",
    icon: "doc",
    items: [
      { t: "Muse Voice Transcribe", d: "Speech to text" },
      { t: "SAM 3.1", d: "Finds the letter in the photo" },
      {
        t: "Muse Spark, letter reader",
        d: "Fills a fixed form and can't take actions",
      },
      { t: "Muse Spark, agent", d: "Saves facts only through tools" },
    ],
  },
  {
    lane: "Code decides",
    icon: "shield",
    items: [
      { t: "Validate", d: "Every field checked before use" },
      {
        t: "Rules engine",
        d: `${SCHEMES.length} schemes, each condition true, false or unknown`,
      },
      { t: "Question planner", d: "Asks what settles the most schemes" },
      {
        t: "Chains and clashes",
        d: "What opens up what, and what lowers what",
      },
    ],
  },
  {
    lane: "You get",
    icon: "spark",
    items: [
      {
        t: "Likely, worth checking, unlocks next",
        d: "With every condition shown",
      },
      { t: "A claim plan", d: "Gateway claims first" },
      { t: "What to say", d: "Call notes from Muse Spark" },
      { t: "A picture of your results", d: "Painted by Muse Image" },
    ],
  },
];

const RULES = [
  "Code decides each result. Models read, ask and explain.",
  "Nothing a model writes reaches the rules until code has checked it.",
  "Letters are read in quarantine and become typed data before any agent that can act sees them.",
  "Beacon never asks for a name, a National Insurance number or bank details, and doesn't copy them from letters.",
  "Answers live in your browser. The server forgets them when the request ends.",
  "Every scheme links to its official page. The organisation that runs it decides.",
];

const MODELS = [
  [
    "Muse Spark 1.3",
    "muse-spark-1.3",
    "Agent chat with tool calling, letter reading with vision and structured output, call notes",
  ],
  [
    "Muse Voice Transcribe",
    "muse-voice-transcribe-1.0",
    "Turns a spoken answer into text",
  ],
  [
    "SAM 3.1",
    "sam-3.1",
    "Outlines the letter in a photo so you see what was read",
  ],
  [
    "Muse Image",
    "muse-image-1.0",
    "Paints the results banner from life areas only, never personal details",
  ],
];

export default function How() {
  return (
    <div className="site mk-page">
      <SiteHeader current="how" />
      <main>
        <section className="mk-wrap mk-howhero" aria-labelledby="how-h">
          <span className="mk-tag">How it works</span>
          <h1 id="how-h">Small agents, one job each</h1>
          <p className="mk-lead">
            The Muse models listen, read and explain. Plain code makes every
            decision, so the same answers always give the same result.
          </p>
          <dl className="mk-stats">
            <div>
              <dt>Kinds of help</dt>
              <dd>
                <Ticker value={SCHEMES.length} />
              </dd>
            </div>
            <div>
              <dt>Areas of life</dt>
              <dd>
                <Ticker value={TOPICS.length} />
              </dd>
            </div>
            <div>
              <dt>Nations covered</dt>
              <dd>
                <Ticker value={COVERED_NATIONS.length} />
              </dd>
            </div>
            <div>
              <dt>Council pages</dt>
              <dd>
                <Ticker value={COUNTS.councilLinks.links} />
              </dd>
            </div>
            <div>
              <dt>Grant-giving charities</dt>
              <dd>
                <Ticker value={COUNTS.charityFunds.funds} />
              </dd>
            </div>
            <div>
              <dt>Meta models</dt>
              <dd>
                <Ticker value={MODELS.length} />
              </dd>
            </div>
          </dl>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="flow-h">
          <Reveal>
            <SectionHead
              tag="The flow"
              id="flow-h"
              title="From a chat to a plan"
            >
              What you say goes in on the left. A checked plan comes out on the
              right.
            </SectionHead>
          </Reveal>
          <Reveal>
            <Pipeline lanes={FLOW} />
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="loop-h">
          <Reveal>
            <SectionHead
              tag="Eight steps"
              id="loop-h"
              title="Eight steps for every person"
            >
              All eight run in Beacon today. The later steps run in your
              browser, so your claims stay on your device.
            </SectionHead>
          </Reveal>
          <Reveal>
            <StepsRail />
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="models-h">
          <Reveal>
            <SectionHead
              tag="Models"
              id="models-h"
              title="Meta models in Beacon"
            >
              Each model has one job. Code checks everything they hand back
              before you see it.
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
                  <span>{job}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="mk-wrap mk-section" aria-labelledby="rules-h">
          <div className="mk-rules">
            <Reveal>
              <SectionHead
                tag="Promises"
                id="rules-h"
                title="Rules Beacon keeps"
              >
                Written into the code, so they hold for every check.
              </SectionHead>
            </Reveal>
            <Reveal>
              <ol className="mk-ledger">
                {RULES.map((r, i) => (
                  <li key={r}>
                    <span className="n">{String(i + 1).padStart(2, "0")}</span>
                    <span>{r}</span>
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
              tag="Coverage"
              id="cover-h"
              title="What it checks today"
            >
              {SCHEMES.length} kinds of help across {TOPICS.length} areas of
              life in {COVERED_NATIONS_TXT}, from Pension Credit to Healthy
              Start. Income lines are screening estimates, so anything close
              comes back as worth checking.
            </SectionHead>
          </Reveal>
          <Reveal>
            <div className="mk-topics">
              {TOPICS.map(([t, name]) => {
                const list = SCHEMES.filter((s) => s.topic === t);
                return (
                  <div key={t} className="mk-topic">
                    <div className="mk-topic-top">
                      <b>{name}</b>
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
        </section>

        <FinalCta
          title="See what's yours"
          text="Type, speak or snap a letter. Beacon does the checking."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
