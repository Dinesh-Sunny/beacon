"use client";

import { type SchemeId, type StepId, schemeById } from "@beacon/rules";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ROW_LABEL, valueLabel } from "@/lib/answers";
import { useCheck } from "@/lib/check-store";
import { Icon } from "../Icon";
import { findingTitle, VerdictChip } from "../Verdict";
import { RuleLine } from "./FindingCard";
import { Listen } from "./Listen";
import { useResults } from "./use-results";

/** Answers in the order the phone claim asks for them. Amounts are bands; the exact figure is the caller's. */
const PACK_ORDER: Partial<Record<SchemeId, StepId[]>> = {
  "pension-credit": [
    "area",
    "birth-year",
    "household",
    "partner-birth-year",
    "home",
    "money",
    "savings",
    "benefits",
  ],
  "attendance-allowance": ["area", "birth-year", "applies", "benefits", "home"],
};
const NEEDS_EXACT: StepId[] = ["money", "savings"];
const HOW: Record<"phone" | "online" | "council" | "automatic", string> = {
  phone: "Claim by phone",
  online: "Apply online",
  council: "Apply to your council",
  automatic: "Paid without a claim if you qualify",
};
const capFirst = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);

export function FindingDetail({ schemeId }: { schemeId: SchemeId }) {
  const { results, ready } = useResults();
  const { draft } = useCheck();
  const h1 = useRef<HTMLHeadingElement>(null);
  const scheme = schemeById(schemeId);
  const finding = results?.findings.find((f) => f.scheme === schemeId);

  useEffect(() => {
    if (ready) h1.current?.focus();
  }, [ready]);

  if (!ready) return <div className="wrap" aria-busy="true" />;

  if (!finding) {
    return (
      <div className="wrap stack max-w-[720px] gap-4">
        <h1 ref={h1} tabIndex={-1} className="d2 outline-none">
          {scheme.name}
        </h1>
        <p className="lead">{scheme.summary}</p>
        <section className="card stack gap-3" aria-labelledby="about-title">
          <h2 id="about-title" className="t-title">
            About this support
          </h2>
          <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="muted">Run by</dt>
            <dd className="m-0">{capFirst(scheme.runBy)}</dd>
            <dt className="muted">How you get it</dt>
            <dd className="m-0">{HOW[scheme.claim.route]}</dd>
            {scheme.unlocks?.length ? (
              <>
                <dt className="muted">Can open the door to</dt>
                <dd className="m-0">
                  {scheme.unlocks.map((u, i) => (
                    <span key={u}>
                      {i > 0 && ", "}
                      <Link href={`/results/${u}`}>{schemeById(u).name}</Link>
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
          </dl>
          <a
            className="btn txt self-start !pl-0"
            href={scheme.claim.url}
            target="_blank"
            rel="noreferrer"
          >
            Official page on GOV.UK <Icon name="arrow-right" />
          </a>
        </section>
        <p>
          Do a check to see if it may be yours, with the rule line behind it.
        </p>
        <Link className="btn pri self-start" href="/check">
          Start my check
        </Link>
      </div>
    );
  }

  const runBy = scheme.runBy.startsWith("your ")
    ? scheme.runBy.replace("your ", "Your ")
    : scheme.runBy;
  const order =
    scheme.claim.route === "phone" ? (PACK_ORDER[schemeId] ?? []) : [];
  const packRows = order.filter((id) => draft.progress[id] === "done");
  const callNumber = scheme.claim.detail.match(/0800[\d ]+\d/)?.[0];

  return (
    <div className="wrap stack max-w-[880px] gap-12">
      <Link className="btn txt self-start !pl-0 no-print" href="/results">
        Back to results
      </Link>

      <section
        className={`stack gap-5 ${finding.verdict === "likely" ? "glow" : ""}`}
        aria-labelledby="detail-title"
      >
        <VerdictChip verdict={finding.verdict} />
        <h1
          id="detail-title"
          ref={h1}
          tabIndex={-1}
          className="d2 outline-none"
        >
          {findingTitle(scheme.name, finding.verdict)}
        </h1>
        <p className="lead">{finding.why}</p>
        <div className="card !p-7">
          <RuleLine finding={finding} big />
        </div>
        <Listen
          text={`${findingTitle(scheme.name, finding.verdict)}. ${finding.why} The rule says: ${finding.quote}`}
        />
      </section>

      <section className="stack gap-4" aria-labelledby="next-title">
        <h2 id="next-title" className="h-l">
          What to do next
        </h2>
        <p>
          {runBy} runs {scheme.name}. {scheme.claim.detail}.
        </p>
        <div className="acts">
          {callNumber ? (
            <a
              className="btn pri"
              href={`tel:${callNumber.replace(/\s/g, "")}`}
            >
              <Icon name="phone" /> Call {callNumber}
            </a>
          ) : (
            <a
              className="btn pri"
              href={scheme.claim.url}
              target="_blank"
              rel="noreferrer"
            >
              {scheme.claim.route === "automatic"
                ? "See how it is paid"
                : `Apply for ${scheme.name}`}{" "}
              <Icon name="arrow-right" />
            </a>
          )}
          <a
            className="btn txt"
            href={scheme.claim.url}
            target="_blank"
            rel="noreferrer"
          >
            How to claim on GOV.UK
          </a>
        </div>
      </section>

      {scheme.claim.route === "phone" && (
        <section className="card !gap-4 !p-7" aria-labelledby="pack-title">
          <h2 id="pack-title" className="h-m">
            Your call answers, ready
          </h2>
          <p className="small muted">
            In the order the call asks. Have it open or printed when you call.
          </p>
          {packRows.length > 0 ? (
            <dl className="kv">
              {packRows.map((id) => (
                <div key={id}>
                  <dt>{ROW_LABEL[id]}</dt>
                  <dd>
                    {valueLabel(id, draft)}
                    {NEEDS_EXACT.includes(id) && (
                      <span className="small muted block">
                        DWP will ask for the exact figure
                      </span>
                    )}
                  </dd>
                  <span />
                </div>
              ))}
            </dl>
          ) : (
            <p className="small">
              Your answers aren&apos;t in this browser tab.{" "}
              <Link href="/check">Do a check</Link> to get your call answers
              ready.
            </p>
          )}
          {packRows.length > 0 && (
            <button
              type="button"
              className="btn sec self-start no-print"
              onClick={() => window.print()}
            >
              <Icon name="print" /> Print my call answers
            </button>
          )}
        </section>
      )}

      {finding.verdict !== "unlikely-right-now" && (
        <section
          className="stack gap-4 rounded-[var(--radius-lg)] bg-[var(--gate-bg)] p-7"
          aria-labelledby="turn-title"
        >
          <h2 id="turn-title" className="h-m">
            Your turn:{" "}
            {scheme.claim.route === "phone"
              ? `call about ${scheme.name}`
              : scheme.claim.route === "automatic"
                ? "watch for a letter"
                : `apply for ${scheme.name}`}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="stack gap-2">
              <h3 className="t-title">Beacon did</h3>
              <ul className="m-0 stack list-disc gap-1 pl-5">
                <li>Read the official rules on GOV.UK</li>
                {finding.quoteVerified && (
                  <li>Checked the rule line word for word</li>
                )}
                {scheme.claim.route === "phone" && packRows.length > 0 && (
                  <li>Got your answers ready for the call</li>
                )}
              </ul>
            </div>
            <div className="stack gap-2">
              <h3
                className="t-title flex items-center gap-2"
                style={{ color: "var(--gate-accent)" }}
              >
                <Icon name="hand" /> Only you can
              </h3>
              <ul className="m-0 stack list-disc gap-1 pl-5">
                <li>
                  {scheme.claim.route === "phone"
                    ? "Make the call"
                    : scheme.claim.route === "automatic"
                      ? "Check the letter when it comes"
                      : "Fill in and send the form"}
                </li>
                <li>Give the exact figures</li>
                <li>Agree to what you tell them</li>
              </ul>
            </div>
          </div>
          <p className="small">
            Only {runBy === "DWP" ? "DWP" : scheme.runBy} can decide. A free
            adviser can check this with you.
          </p>
        </section>
      )}
    </div>
  );
}
