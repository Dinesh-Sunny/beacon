import { RULES_AS_OF, SCHEMES } from "@beacon/rules";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About Beacon" };

// D-090: a calm explainer. Prose sections at a 640px measure.
export default function About() {
  return (
    <article className="wrap stack max-w-[720px] gap-12">
      <header className="stack gap-4">
        <h1 className="d2">About Beacon</h1>
        <p className="lead">
          A free, private check that reads the official rules for you and shows
          the line behind every answer.
        </p>
      </header>

      <section className="stack gap-3" aria-labelledby="who">
        <h2 id="who" className="h-l">
          Who runs it
        </h2>
        <p>
          Beacon is independent. It is not part of the government, DWP or any
          council.
        </p>
        <p>Beacon is open source, so anyone can see how it works.</p>
        {/* TODO(Dinesh): repository link, who funds Beacon, and a contact address. Confirm before launch. */}
        {SITE.repositoryUrl && (
          <p>
            <a href={SITE.repositoryUrl}>See the source code</a>
          </p>
        )}
      </section>

      <section className="stack gap-3" aria-labelledby="how">
        <h2 id="how" className="h-l">
          How it checks
        </h2>
        <p>
          You answer a few everyday questions. We skip the ones that can&apos;t
          change a result.
        </p>
        <p>
          Rules that your answers settle on their own are worked out in plain
          code. For the rest, Beacon reads the official GOV.UK page in full and
          quotes the line it relies on.
        </p>
        <p>
          A result only says Likely when that line is found word for word on the
          page. Otherwise it says Worth checking.
        </p>
        <p className="small muted">
          Beacon checks {SCHEMES.length} kinds of support in England today. Its
          rule figures were last checked on {formatDate(RULES_AS_OF)}.
        </p>
      </section>

      <section className="stack gap-3" aria-labelledby="never">
        <h2 id="never" className="h-l">
          What it never asks
        </h2>
        <p>
          Beacon never asks for your name, address, bank details, National
          Insurance number or any money.
        </p>
        <p>
          We ask for the first half of your postcode, your birth year and rough
          bands for money. Never exact amounts or your full date of birth.
        </p>
      </section>

      <section className="stack gap-3" aria-labelledby="privacy">
        <h2 id="privacy" className="h-l">
          Your privacy
        </h2>
        <p>
          Your answers stay in your browser. When you press Read the rules for
          me, they are sent once to work out your results, then dropped.
        </p>
        <p>
          Nothing is saved on our side. Your private link keeps your results in
          the link itself, never your answers.
        </p>
        <p>
          Need to leave quickly? Press Leave this page, or press Shift 3 times.
        </p>
      </section>

      <section className="stack gap-3" aria-labelledby="decision">
        <h2 id="decision" className="h-l">
          Guidance, not a decision
        </h2>
        <p>
          Only the official service decides. Always confirm with GOV.UK or a
          free adviser.
        </p>
        <div className="acts">
          <Link className="btn pri" href="/check">
            Start my check
          </Link>
        </div>
      </section>
    </article>
  );
}
