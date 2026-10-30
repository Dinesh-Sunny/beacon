"use client";

import { type Finding, schemeById, VERDICT_LABEL } from "@beacon/rules";
import { useEffect, useRef } from "react";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

/** "This looks wrong": a report with the result only, never the person's answers. */
export function ReportSheet({
  finding,
  onClose,
}: {
  finding: Finding | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (finding && !d.open) d.showModal();
    if (!finding && d.open) d.close();
  }, [finding]);

  const name = finding ? schemeById(finding.scheme).name : "";
  const subject = `Beacon result looks wrong: ${name}`;
  const text = finding
    ? `Kind of support: ${name}\nWhat Beacon said: ${VERDICT_LABEL[finding.verdict]}\nRule page: ${finding.source.url}\n\nWhat looks wrong (please no names or personal details):\n`
    : "";
  const email = env.NEXT_PUBLIC_REPORT_EMAIL;
  const issues = env.NEXT_PUBLIC_REPORT_ISSUES_URL;

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="report-title"
      onClose={onClose}
    >
      <div className="stack gap-4">
        <h2 id="report-title" className="h-m">
          Report a wrong answer
        </h2>
        <p>
          Tell us what looks wrong with this result. We only send the result and
          its rule page, never your answers.
        </p>
        <p className="small muted">
          Please don&apos;t add your name or any personal details.
        </p>
        <div className="acts">
          {email && (
            <a
              className="btn pri"
              href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
            >
              Send report by email
            </a>
          )}
          {issues && (
            <a
              className="btn sec"
              href={`${issues}/new?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              Report it on GitHub
            </a>
          )}
          {!email && !issues && (
            <p className="small">
              Reporting opens soon. Until then, check the rule on GOV.UK or talk
              it through with{" "}
              <a href={SITE.freeHelpUrl} target="_blank" rel="noreferrer">
                a free adviser
              </a>
              .
            </p>
          )}
          <button
            type="button"
            className="btn txt"
            onClick={() => ref.current?.close()}
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
