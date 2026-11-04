import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Logo } from "@/components/Icon";
import { SiteFooter } from "@/components/SiteFooter";
import { SCHEMES, TOPICS } from "@/engine/rules";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Beacon's agents turn a chat, a voice note or a photo of a letter into a checked list of support and a plan to claim it.",
};

const FLOW = [
  {
    lane: "You",
    items: [
      { t: "Type", d: "Plain words in the chat" },
      { t: "Speak", d: "Recorded in your browser" },
      { t: "Snap a letter", d: "Shrunk and stripped of photo data first" },
      { t: "Answer a question", d: "The right input for each fact" },
    ],
  },
  {
    lane: "Muse models read",
    items: [
      { t: "Muse Voice Transcribe", d: "Speech to text" },
      { t: "SAM 3.1", d: "Finds the letter in the photo" },
      { t: "Muse Spark, letter reader", d: "Fills a fixed form, can't take actions" },
      { t: "Muse Spark, agent", d: "Saves facts only through tools" },
    ],
  },
  {
    lane: "Code decides",
    items: [
      { t: "Validate", d: "Every field checked before use" },
      { t: "Rules engine", d: `${SCHEMES.length} schemes, each condition true, false or unknown` },
      { t: "Question planner", d: "Asks what settles the most schemes" },
      { t: "Chains and clashes", d: "What unlocks what, and what lowers what" },
    ],
  },
  {
    lane: "You get",
    items: [
      { t: "Likely, worth checking, unlocks next", d: "With every condition shown" },
      { t: "A claim plan", d: "Gateway claims first" },
      { t: "What to say", d: "Call notes from Muse Spark" },
      { t: "A picture of your results", d: "Painted by Muse Image" },
    ],
  },
];

const LOOP = [
  ["Understand", "Learn the person, one small question at a time", true],
  ["Match", "Check every scheme and find claim chains", true],
  ["Warn", "Flag claims that could lower another", true],
  ["Act", "Put claims in order and prepare each call", true],
  ["Confirm", "Record what was awarded and help challenge a wrong decision", false],
  ["Receive", "Check the first payment lands and is right", false],
  ["Keep", "Report changes on time so nothing is paid back", false],
  ["Watch", "Re-check when life or the rules change", false],
] as const;

const RULES = [
  "Code decides each result. Models read, ask and explain.",
  "Nothing a model writes reaches the rules until code has checked it.",
  "Letters are read in quarantine and become typed data before any agent that can act sees them.",
  "Beacon never asks for a name, a National Insurance number or bank details, and doesn't copy them from letters.",
  "Answers live in your browser. The server forgets them when the request ends.",
  "Every scheme links to its official page. The organisation that runs it decides.",
];

const MODELS = [
  ["Muse Spark 1.3", "muse-spark-1.3", "Agent chat with tool calling, letter reading with vision and structured output, call notes"],
  ["Muse Voice Transcribe", "muse-voice-transcribe-1.0", "Turns a spoken answer into text"],
  ["SAM 3.1", "sam-3.1", "Outlines the letter in a photo so you see what was read"],
  ["Muse Image", "muse-image-1.0", "Paints the results banner from life areas only, never personal details"],
];

export default function How() {
  return (
    <div className="site">
      <header className="site-head">
        <Link href="/" className="brand">
          <Logo />
          <span>Beacon</span>
        </Link>
        <nav>
          <Link href="/check" className="btn small">
            Start a check
          </Link>
        </nav>
      </header>
      <main className="page how">
        <section className="how-hero">
          <h1>How Beacon works</h1>
          <p className="lead">
            A team of small agents, each with one job. The Muse models listen, read and explain. Plain code makes every decision,
            so the same answers always give the same result.
          </p>
        </section>

        <section aria-labelledby="flow-h">
          <h2 id="flow-h">From a chat to a plan</h2>
          <div className="flow">
            {FLOW.map((col, i) => (
              <div key={col.lane} className={`flow-col c${i}`}>
                <span className="eyebrow">{col.lane}</span>
                {col.items.map((it) => (
                  <div key={it.t} className="flow-item">
                    <b>{it.t}</b>
                    <span>{it.d}</span>
                  </div>
                ))}
                {i < FLOW.length - 1 && (
                  <span className="flow-arrow" aria-hidden="true">
                    <Icon name="arrow" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="loop-h">
          <h2 id="loop-h">Eight steps for every person</h2>
          <p className="lead">The first four run in Beacon today. The rest is where it's going.</p>
          <ol className="loop">
            {LOOP.map(([t, d, live], i) => (
              <li key={t} className={live ? "live" : ""}>
                <span className="eyebrow">
                  {i + 1} · {live ? "Live" : "Next"}
                </span>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="models-h2">
          <h2 id="models-h2">Meta models in Beacon</h2>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>ID</th>
                  <th>Job</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map(([n, id, job]) => (
                  <tr key={id}>
                    <td>{n}</td>
                    <td>
                      <code>{id}</code>
                    </td>
                    <td>{job}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="rules-h">
          <h2 id="rules-h">Rules Beacon keeps</h2>
          <ul className="rules-list">
            {RULES.map((r) => (
              <li key={r}>
                <Icon name="shield" /> {r}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cover-h">
          <h2 id="cover-h">What it checks today</h2>
          <p className="lead">
            {SCHEMES.length} kinds of help across {TOPICS.length} areas of life in England, Scotland and Wales,
            from Pension Credit to Healthy Start. Income lines are screening estimates, so anything close comes back as worth
            checking.
          </p>
          <div className="cover">
            {TOPICS.map(([t, name]) => (
              <div key={t}>
                <b>{name}</b>
                <span>
                  {SCHEMES.filter((s) => s.topic === t)
                    .map((s) => s.name)
                    .join(", ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
