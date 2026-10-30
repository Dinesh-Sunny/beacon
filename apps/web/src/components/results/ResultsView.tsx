"use client";

import { type Finding, rankFindings, schemeById } from "@beacon/rules";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCheck } from "@/lib/check-store";
import { SITE } from "@/lib/site";
import { Icon } from "../Icon";
import { VerdictBar } from "../Verdict";
import { FindingCard } from "./FindingCard";
import { headline } from "./Reading";
import { ReportSheet } from "./ReportSheet";
import { useResults } from "./use-results";

const STEP_LABEL = {
  judge: "Checking the rule",
  explain: "Explaining it simply",
} as const;

export function ResultsView() {
  const { results, ready, shareUrl } = useResults();
  const them = useCheck().draft.situation.forSomeoneElse;
  const [report, setReport] = useState<Finding | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const h1 = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    h1.current?.focus();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready) return <div className="wrap" aria-busy="true" />;

  if (!results) {
    return (
      <div className="wrap stack max-w-[720px] gap-4">
        <h1 className="d2">No results yet</h1>
        <p className="lead">
          Answer a few simple questions and we&apos;ll read the official rules
          for you.
        </p>
        <Link className="btn pri self-start" href="/check">
          Start my check
        </Link>
      </div>
    );
  }

  const ranked = rankFindings(results.findings);
  const main = ranked.filter((f) => f.verdict !== "unlikely-right-now");
  const unlikely = ranked.filter((f) => f.verdict === "unlikely-right-now");
  const topLikely = ranked.find((f) => f.verdict === "likely")?.scheme;
  const unread = results.unread ?? [];
  const noneClear = !ranked.some(
    (f) => f.verdict === "likely" || f.verdict === "worth-checking",
  );
  const nothing = noneClear && unread.length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Link copied. It shows your results, not your answers.");
    } catch {
      setToast("Copy the address from the bar at the top to save it.");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "My Beacon results", url: shareUrl });
    } catch {
      // The person closed the share sheet.
    }
  };

  return (
    <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="stack min-w-0 gap-8">
        <div className={`stack gap-4 ${topLikely ? "glow" : ""}`}>
          <p className="cap">What may be yours</p>
          <h1 ref={h1} tabIndex={-1} className="d2 outline-none">
            {nothing
              ? "Nothing clear today"
              : noneClear
                ? "We couldn't finish reading today"
                : headline(ranked, them)}
          </h1>
          <p className="lead">
            {nothing
              ? "That can change when life does. A free adviser can look at things we can't."
              : noneClear
                ? "Here is what we could settle. The rest still need checking."
                : "Each card shows the rule it comes from. Start with the first one."}
          </p>
          <VerdictBar
            verdicts={ranked.map((f) => f.verdict)}
            label={headline(ranked, them)}
          />
          {topLikely && (
            <a className="small self-start" href="#start-here">
              Go to where to start
            </a>
          )}
        </div>

        {results.fromLink && (
          <div className="banner info" role="note">
            <Icon name="info" className="mt-0.5 flex-none" />
            <span>
              These results came from a shared link. Check each one on its
              GOV.UK page, or <Link href="/check">start your own check</Link>.
            </span>
          </div>
        )}

        {unread.length > 0 && (
          <section className="card stack gap-3" aria-labelledby="unread-title">
            <h2 id="unread-title" className="t-title">
              These still need checking ({unread.length})
            </h2>
            <p className="small muted">
              We couldn&apos;t read these today. Try again later, or open the
              official page.
            </p>
            <ul className="m-0 stack gap-2 pl-5">
              {unread.map((id) => {
                const s = schemeById(id);
                return (
                  <li key={id}>
                    <a
                      href={`https://www.gov.uk${s.govukPaths[0] ?? ""}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.name} on GOV.UK
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="stack gap-5">
          {main.map((f) => (
            <FindingCard
              forSomeoneElse={them}
              key={f.scheme}
              finding={f}
              startHere={f.scheme === topLikely}
              onReport={setReport}
            />
          ))}
        </div>

        {unlikely.length > 0 && (
          <details className="why card">
            <summary>
              <Icon name="chevron-down" className="chev" />
              Unlikely right now ({unlikely.length})
            </summary>
            <p className="small muted">
              Things change. Each one says why, and you can check again any
              time.
            </p>
            <div className="stack mt-3 gap-4">
              {unlikely.map((f) => (
                <FindingCard
                  key={f.scheme}
                  finding={f}
                  onReport={setReport}
                  forSomeoneElse={them}
                />
              ))}
            </div>
          </details>
        )}

        <p className="banner">
          Guidance, not a decision. Only the people who run each kind of support
          can decide. Check with GOV.UK or a free adviser.
        </p>

        <details className="why no-print">
          <summary>
            <Icon name="chevron-down" className="chev" />
            How Beacon worked this out
          </summary>
          <div className="stack mt-2 gap-3 pl-7">
            <p className="small">
              Rules that can be settled from your answers are settled first, in
              plain code. Then Beacon reads each official GOV.UK page in full
              and quotes the line it relies on. A result only says Likely when
              that line is found word for word on the page.
            </p>
            {results.model && (
              <p className="small muted">Read with: {results.model}</p>
            )}
            {results.usage.length > 0 ? (
              <table className="small w-full border-collapse text-left">
                <caption className="sr-only">Work done for each step</caption>
                <thead>
                  <tr>
                    <th className="py-1">Step</th>
                    <th className="py-1">Support</th>
                    <th className="py-1">Effort</th>
                    <th className="py-1 text-right">Tokens in</th>
                    <th className="py-1 text-right">Tokens out</th>
                  </tr>
                </thead>
                <tbody className="data">
                  {results.usage.map((u, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: usage rows are an ordered log
                    <tr key={i} className="border-t border-hairline">
                      <td className="py-1">{STEP_LABEL[u.step]}</td>
                      <td className="py-1">{u.scheme ?? "-"}</td>
                      <td className="py-1">{u.effort}</td>
                      <td className="py-1 text-right">
                        {u.inputTokens.toLocaleString("en-GB")}
                      </td>
                      <td className="py-1 text-right">
                        {u.outputTokens.toLocaleString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small muted">
                No model steps were needed for this check.
              </p>
            )}
          </div>
        </details>
      </div>

      <aside
        className="stack gap-4 no-print lg:sticky lg:top-24 lg:self-start"
        aria-label="Save or share"
      >
        <section className="card">
          <h2 className="t-title">Save or share your results</h2>
          <p className="small muted">
            Come back to them later, or share them with someone who helps you.
            No name needed.
          </p>
          <div className="stack gap-2">
            <button
              type="button"
              className="btn sec justify-start"
              onClick={() => void copy()}
            >
              <Icon name="link" /> Copy my private link
            </button>
            <button
              type="button"
              className="btn sec justify-start"
              onClick={() => window.print()}
            >
              <Icon name="print" /> Print
            </button>
            {canShare && (
              <button
                type="button"
                className="btn sec justify-start"
                onClick={() => void share()}
              >
                <Icon name="share" /> Share
              </button>
            )}
          </div>
          <p className="small muted">
            The link shows your results, never your answers.
          </p>
        </section>
        <section className="card">
          <h2 className="t-title">Talk it through with a free adviser</h2>
          <p className="small muted">
            An adviser can check things the rules page cannot show.
          </p>
          <a
            className="small"
            href={SITE.freeHelpUrl}
            target="_blank"
            rel="noreferrer"
          >
            Find free help
          </a>
        </section>
        <Link className="btn txt self-start" href="/check">
          Change my answers
        </Link>
      </aside>

      <ReportSheet finding={report} onClose={() => setReport(null)} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
