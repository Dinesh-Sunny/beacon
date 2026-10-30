import { BEAM_DEFAULTS, EFFORT, LIMITS } from "@beacon/brain/config";
import { RULES_AS_OF, SCHEMES } from "@beacon/rules";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/site";
import { benchStats } from "@/lib/transparency";

export const metadata: Metadata = { title: "How Beacon is checked" };

const NATION_NAME = {
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
} as const;
const NATION_ORDER = [
  "england",
  "scotland",
  "wales",
  "northern-ireland",
] as const;

// S-013 Transparency: what Beacon reads, how the Beam model is used, how it is tested, and its limits.
// Every number on this page is computed from the code or the dataset at build time.
export default function Transparency() {
  const bench = benchStats();
  const n = (x: number) => x.toLocaleString("en-GB");
  return (
    <article className="wrap stack max-w-[760px] gap-12">
      <header className="stack gap-4">
        <h1 className="d2">How Beacon is checked</h1>
        <p className="lead">
          What Beacon reads, how it decides, how we test it, and what it
          can&apos;t do yet.
        </p>
      </header>

      <section className="stack gap-4" aria-labelledby="rules">
        <h2 id="rules" className="h-l">
          The rules we read
        </h2>
        <p>
          Rules checked on {formatDate(RULES_AS_OF)}. Beacon reads the official
          page each time, and every result shows the date it was read.
        </p>
        <div className="card !p-0 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Support</th>
                <th scope="col">Where Beacon checks it</th>
                <th scope="col">Official page</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMES.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  <td>
                    {NATION_ORDER.filter((x) => s.nations.includes(x))
                      .map((x) => NATION_NAME[x])
                      .join(", ")}
                  </td>
                  <td>
                    <a
                      href={`https://www.gov.uk${s.govukPaths[0] ?? ""}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      GOV.UK<span className="sr-only">: {s.name}</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack gap-4" aria-labelledby="how">
        <h2 id="how" className="h-l">
          How a result is made
        </h2>
        <ol className="m-0 stack list-decimal gap-3 pl-5">
          <li>
            <strong>Code first.</strong> Hard rules (age lines, savings limits,
            what you already get) are settled in code. The model only reads what
            is still open.
          </li>
          <li>
            <strong>The Beam model reads the page.</strong> For each kind of
            support still open, a reader gets the official page and your answers
            as bands, and records one verdict with the sentence it rests on. It
            thinks at <em>{EFFORT.judge}</em> effort for this step and{" "}
            <em>{EFFORT.explain}</em> when explaining.
          </li>
          <li>
            <strong>Code checks the quote.</strong> A result can only say Likely
            when its quoted sentence is found word for word on the page.
            Otherwise it becomes Worth checking.
          </li>
        </ol>
        <dl className="kv">
          <div>
            <dt>Model</dt>
            <dd>
              <a
                href={`https://huggingface.co/${BEAM_DEFAULTS.model}`}
                target="_blank"
                rel="noreferrer"
              >
                {BEAM_DEFAULTS.model}
              </a>
            </dd>
            <span />
          </div>
          <div>
            <dt>Pages read at once</dt>
            <dd>{LIMITS.parallelReaders}</dd>
            <span />
          </div>
          <div>
            <dt>Model calls per kind of support</dt>
            <dd>Up to {LIMITS.modelCallsPerScheme}</dd>
            <span />
          </div>
          <div>
            <dt>Token budget per check</dt>
            <dd>{n(LIMITS.tokensPerCheck)}</dd>
            <span />
          </div>
        </dl>
      </section>

      <section className="stack gap-4" aria-labelledby="bench">
        <h2 id="bench" className="h-l">
          How we test it: {bench.name}
        </h2>
        <p>
          {bench.cases} made-up situations, no real people, with the answer the
          official rules give for each kind of support. The expected answers
          were written from the rules, never from Beacon&apos;s output.
        </p>
        <dl className="kv">
          <div>
            <dt>Judgements in the set</dt>
            <dd>{n(bench.judgements)}</dd>
            <span />
          </div>
          <div>
            <dt>Settled in code</dt>
            <dd>
              {n(bench.codeAgrees)} of {n(bench.settledInCode)} match the rules
            </dd>
            <span />
          </div>
          <div>
            <dt>Left for the Beam model</dt>
            <dd>
              {n(bench.leftForBeam)}. Scores are published after each run.
            </dd>
            <span />
          </div>
        </dl>
        <p className="small muted">
          Version {bench.version}, judged as of {formatDate(bench.asOf)}.
        </p>
      </section>

      <section className="stack gap-3" aria-labelledby="limits">
        <h2 id="limits" className="h-l">
          What Beacon can&apos;t do yet
        </h2>
        <ul className="m-0 stack list-disc gap-2 pl-5">
          <li>
            It checks {SCHEMES.length} kinds of support, set up for England.
            Some work differently in Scotland, Wales and Northern Ireland, and
            Beacon says so.
          </li>
          <li>
            It never works out an amount. That needs exact figures, which Beacon
            never asks for.
          </li>
          <li>
            It gives guidance, not a decision. Only the people who run each kind
            of support can decide.
          </li>
          <li>
            If an official page changes after it was read, a result can be out
            of date until the next read.
          </li>
        </ul>
        <p>
          Spotted something wrong? Every result has a &quot;This looks
          wrong&quot; link. <Link href="/about">How Beacon works</Link> explains
          what we keep and what we don&apos;t.
        </p>
      </section>
    </article>
  );
}
