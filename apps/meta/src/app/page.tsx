import type { Metadata } from "next";
import Link from "next/link";
import { HomeStart } from "@/components/home/HomeStart";
import { Icon, Logo } from "@/components/Icon";
import { SiteFooter } from "@/components/SiteFooter";
import { SCHEMES } from "@/engine/rules";

export const metadata: Metadata = { title: { absolute: "Beacon - find the support that's already yours" } };

const STEPS = [
  { icon: "chat", title: "Tell it your way", text: "Type, speak, or snap a letter. Beacon asks only what could still change an answer." },
  { icon: "shield", title: "Rules decide, not guesses", text: `Plain code checks ${SCHEMES.length} kinds of help against the official rules, live as you answer.` },
  { icon: "warn", title: "Warnings before you claim", text: "If one claim could lower another, you hear it first, in plain words." },
  { icon: "phone", title: "Ready to claim", text: "The right order, the number to call, and notes on what to say." },
];

const MODELS = [
  { name: "Muse Spark", job: "Talks with you, saves what you say, reads letters and writes your call notes" },
  { name: "Muse Voice Transcribe", job: "Turns what you say aloud into text" },
  { name: "SAM 3.1", job: "Finds the letter in your photo" },
  { name: "Muse Image", job: "Paints a warm picture for your results" },
];

export default function Home() {
  return (
    <div className="site">
      <header className="site-head">
        <Link href="/" className="brand">
          <Logo />
          <span>Beacon</span>
        </Link>
        <nav>
          <Link href="/how">How it works</Link>
          <Link href="/check" className="btn small">
            Start a check
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Find the support that's already yours.</h1>
            <p className="lead">
              Tell Beacon about your life, or the life of someone you look after. It shows what help is likely yours and gets you
              ready to claim.
            </p>
            <HomeStart />
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="glow" />
            <div className="preview">
              <div className="pv-row likely">
                <span>Pension Credit</span>
                <em>Likely</em>
              </div>
              <div className="pv-row likely">
                <span>Attendance Allowance</span>
                <em>Likely</em>
              </div>
              <div className="pv-row check">
                <span>Council Tax Reduction</span>
                <em>Worth checking</em>
              </div>
              <div className="pv-row unlock">
                <span>Free TV licence</span>
                <em>Unlocks next</em>
              </div>
              <div className="pv-note">
                <Icon name="spark" size={16} /> Attendance Allowance can raise Pension Credit, so claim both.
              </div>
            </div>
          </div>
        </section>

        <section className="band">
          <p className="big-stat">About £24.1bn a year</p>
          <p>
            of income-related benefits and social tariffs goes unclaimed in Great Britain, across more than 7 million households.
            Most people miss out because they don't know, or the rules are hard to read.{" "}
            <a href="https://policyinpractice.co.uk/publication/missing-out-2025" target="_blank" rel="noreferrer">
              Policy in Practice, Missing Out 2025
            </a>
          </p>
        </section>

        <section className="steps" aria-labelledby="steps-h">
          <h2 id="steps-h">How a check works</h2>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-icon">
                  <Icon name={s.icon} size={22} />
                </span>
                <span className="eyebrow">Step {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="models" aria-labelledby="models-h">
          <div>
            <h2 id="models-h">Built on Meta's Muse models</h2>
            <p className="lead">Each model has one job. Code checks everything they hand back before you see it.</p>
          </div>
          <ul>
            {MODELS.map((m) => (
              <li key={m.name}>
                <b>{m.name}</b>
                <span>{m.job}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="trust" aria-labelledby="trust-h">
          <h2 id="trust-h">Private by design</h2>
          <div className="trust-grid">
            <p>
              <Icon name="lock" /> Your answers stay in this browser. Nothing is saved on a server.
            </p>
            <p>
              <Icon name="shield" /> Beacon never asks for a name, a National Insurance number or bank details.
            </p>
            <p>
              <Icon name="doc" /> Letters are read once. Names and reference numbers are taken out before anything is shown.
            </p>
          </div>
          <Link href="/check" className="btn">
            Start a check <Icon name="arrow" size={18} />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
