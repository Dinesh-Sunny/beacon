import { type Finding, schemeById } from "@beacon/rules";
import Link from "next/link";
import { formatDate } from "@/lib/site";
import { Icon } from "../Icon";
import { findingTitle, VerdictChip } from "../Verdict";

/** The rule receipt: the exact line from GOV.UK, where it came from and when we read it. */
export function RuleLine({
  finding,
  big = false,
}: {
  finding: Finding;
  big?: boolean;
}) {
  const read = formatDate(finding.source.readAt);
  return (
    <div
      className={`receipt stack gap-2 ${finding.quoteVerified ? "" : "unverified"}`}
    >
      {finding.quote ? (
        <>
          <p className="cap">The rules say</p>
          <blockquote className={`quote m-0 ${big ? "!text-[24px]" : ""}`}>
            &ldquo;{finding.quote}&rdquo;
          </blockquote>
          {!finding.quoteVerified && (
            <p className="small muted">
              We could not match this line word for word, so check it on the
              page.
            </p>
          )}
        </>
      ) : (
        <p className="small muted">
          Read the official rule for this on GOV.UK.
        </p>
      )}
      <p className="small flex flex-wrap gap-x-4 gap-y-1">
        <a href={finding.source.url} target="_blank" rel="noreferrer">
          {finding.quote
            ? "See this line on GOV.UK"
            : `${finding.source.title} on GOV.UK`}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {read && <span className="muted">Read {read}</span>}
      </p>
    </div>
  );
}

export function FindingCard({
  finding,
  startHere,
  onReport,
  forSomeoneElse = false,
}: {
  finding: Finding;
  startHere?: boolean;
  onReport: (f: Finding) => void;
  forSomeoneElse?: boolean;
}) {
  const scheme = schemeById(finding.scheme);
  const title = findingTitle(scheme.name, finding.verdict, forSomeoneElse);
  return (
    <article
      id={startHere ? "start-here" : undefined}
      className={`card !gap-4 !p-6 ${finding.verdict === "likely" ? "border-[var(--border-strong)]" : ""}`}
      aria-labelledby={`t-${finding.scheme}`}
      data-testid="finding"
    >
      <div className="flex flex-wrap items-center gap-2">
        <VerdictChip verdict={finding.verdict} />
        {startHere && (
          <span className="tag !bg-[var(--verdict-likely-soft)]">
            Start here
          </span>
        )}
      </div>
      <h2 id={`t-${finding.scheme}`} className="h-m">
        {startHere && <span className="sr-only">Start here: </span>}
        {title}
      </h2>
      <p>{finding.why}</p>
      {finding.becauseYouSaid.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-2 p-0"
          aria-label="Because you said"
        >
          {finding.becauseYouSaid.map((b) => (
            <li key={b} className="chip">
              Because you said {b}
            </li>
          ))}
        </ul>
      )}
      {finding.missing && (
        <p className="small muted">
          One more answer would tell us: {finding.missing}
        </p>
      )}
      <RuleLine finding={finding} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 no-print">
        {finding.verdict !== "unlikely-right-now" && (
          <Link
            className="btn sec !min-h-11"
            href={`/results/${finding.scheme}`}
          >
            {finding.verdict === "already-get"
              ? "See what it leads to"
              : "See what to do next"}{" "}
            <Icon name="arrow-right" size={18} />
          </Link>
        )}
        <button
          type="button"
          className="btn txt"
          onClick={() => onReport(finding)}
        >
          This looks wrong
        </button>
      </div>
    </article>
  );
}
