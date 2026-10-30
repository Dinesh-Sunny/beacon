"use client";

import {
  type CheckEvent,
  type Finding,
  rankFindings,
  type SchemeId,
  schemeById,
  type Verdict,
} from "@beacon/rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { situationForCheck } from "@/lib/answers";
import { type Usage, useCheck } from "@/lib/check-store";
import { Icon } from "../Icon";
import { VerdictBar } from "../Verdict";

type RowStatus = "waiting" | "reading" | "done" | "failed";

/** Reads the NDJSON stream from /api/check, one event per line. */
async function* readEvents(res: Response): AsyncGenerator<CheckEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines)
      if (line.trim()) yield JSON.parse(line) as CheckEvent;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as CheckEvent;
}

export function headline(findings: Finding[]): string {
  const likely = findings.filter((f) => f.verdict === "likely").length;
  const worth = findings.filter((f) => f.verdict === "worth-checking").length;
  if (likely > 0)
    return `${likely} ${likely === 1 ? "looks" : "look"} likely for you`;
  if (worth > 0) return `${worth} ${worth === 1 ? "is" : "are"} worth checking`;
  return "Nothing clear today";
}

export function Reading() {
  const { draft, setResults } = useCheck();
  const router = useRouter();
  const [plan, setPlan] = useState<SchemeId[]>([]);
  const [rows, setRows] = useState<Partial<Record<SchemeId, RowStatus>>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const h1 = useRef<HTMLHeadingElement>(null);
  const hasAnswers = Object.keys(draft.progress).length > 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: one check per attempt
  useEffect(() => {
    if (!hasAnswers) return;
    const abort = new AbortController();
    const usage: Usage[] = [];
    let got: Finding[] = [];
    setPlan([]);
    setRows({});
    setFindings([]);
    setFinished(false);
    setProblem(null);
    (async () => {
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(situationForCheck(draft)),
          signal: abort.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setProblem(
            body.message ??
              "That took longer than usual. Your answers are safe.",
          );
          return;
        }
        for await (const e of readEvents(res)) {
          if (e.type === "precheck") setTotal(e.items.length);
          else if (e.type === "plan") {
            setPlan(e.schemes);
            setRows(Object.fromEntries(e.schemes.map((s) => [s, "waiting"])));
          } else if (e.type === "reading")
            setRows((r) => ({ ...r, [e.scheme]: e.status }));
          else if (e.type === "finding") {
            got = [
              ...got.filter((f) => f.scheme !== e.finding.scheme),
              e.finding,
            ];
            setFindings(got);
          } else if (e.type === "usage") usage.push(e);
          else if (e.type === "error") setProblem(e.message);
          else if (e.type === "done") {
            got = rankFindings(e.findings.length ? e.findings : got);
            setFindings(got);
            setResults({
              findings: got,
              usage,
              model: e.model,
              snapshot: e.snapshot,
            });
            setFinished(true);
          }
        }
      } catch {
        if (!abort.signal.aborted)
          setProblem("That took longer than usual. Your answers are safe.");
      }
    })();
    return () => abort.abort();
  }, [attempt, hasAnswers]);

  useEffect(() => {
    if (finished) h1.current?.focus();
  }, [finished]);

  if (!hasAnswers) {
    return (
      <div className="wrap stack max-w-[720px] gap-4">
        <h1 className="d2">Let&apos;s start with a few questions</h1>
        <p className="lead">
          We need your answers before we can read the rules.
        </p>
        <Link className="btn pri self-start" href="/check">
          Start my check
        </Link>
      </div>
    );
  }

  const verdicts: Verdict[] = findings.map((f) => f.verdict);
  const segments: (Verdict | "pending")[] = [
    ...rankFindings(findings).map((f) => f.verdict),
    ...Array<"pending">(Math.max(0, total - verdicts.length)).fill("pending"),
  ];
  const doneCount = plan.filter(
    (s) => rows[s] === "done" || rows[s] === "failed",
  ).length;

  return (
    <div className="wrap stack max-w-[760px] gap-8">
      {!finished ? (
        <div className="stack gap-3">
          <h1 className="d2">Reading the rules on GOV.UK</h1>
          <p className="lead">
            Beacon is checking {plan.length || "each"} kinds of support against
            the official GOV.UK pages. You can see each result as soon as it is
            ready.
          </p>
        </div>
      ) : (
        <div className="stack glow gap-3">
          <h1
            ref={h1}
            tabIndex={-1}
            className="d2 outline-none"
            data-testid="reveal"
          >
            {headline(findings)}
          </h1>
          <p className="lead">
            Each result quotes the rule it comes from, with the page and the
            date we read it.
          </p>
        </div>
      )}

      {total > 0 && (
        <VerdictBar
          verdicts={
            finished
              ? rankFindings(findings).map((f) => f.verdict)
              : segments.slice(0, total)
          }
          label={`${verdicts.length} of ${total} results ready`}
        />
      )}

      {problem && (
        <div className="err-summary" role="alert">
          <h2 className="t-title">That took longer than usual</h2>
          <p>{problem}</p>
          <div className="acts">
            <button
              type="button"
              className="btn pri"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
            {findings.length > 0 && (
              <button
                type="button"
                className="btn sec"
                onClick={() => {
                  setResults({
                    findings: rankFindings(findings),
                    usage: [],
                    model: "",
                    snapshot: false,
                  });
                  router.push("/results");
                }}
              >
                See the {findings.length === 1 ? "one" : findings.length} we
                could settle
              </button>
            )}
            <Link className="btn txt" href="/check">
              Back to my answers
            </Link>
          </div>
        </div>
      )}

      {plan.length > 0 && (
        <section className="card" aria-labelledby="plan-title">
          <h2 id="plan-title" className="t-title">
            Reading plan
          </h2>
          <ul className="m-0 list-none p-0" data-testid="reading-plan">
            {plan.map((id) => {
              const st = rows[id] ?? "waiting";
              const scheme = schemeById(id);
              return (
                <li key={id} className="row-status">
                  <span
                    aria-hidden="true"
                    className="inline-flex justify-center"
                  >
                    {st === "reading" ? (
                      <span className="spin" />
                    ) : st === "done" ? (
                      <Icon name="check" />
                    ) : st === "failed" ? (
                      <Icon name="info" />
                    ) : (
                      <span className="dot todo !h-3 !w-3" />
                    )}
                  </span>
                  <span>{scheme.name}</span>
                  <span className="small muted">
                    {st === "reading" && "Reading"}
                    {st === "done" && "Read"}
                    {st === "waiting" && "Next"}
                    {st === "failed" && (
                      <>
                        We could not read the page.{" "}
                        <a
                          href={`https://www.gov.uk${scheme.govukPaths[0] ?? ""}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open it on GOV.UK
                        </a>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="sr-only" role="status">
            {doneCount} of {plan.length} read
          </p>
        </section>
      )}

      {finished && (
        <div className="acts">
          <button
            type="button"
            className="btn pri"
            onClick={() => router.push("/results")}
          >
            See what may be yours <Icon name="arrow-right" />
          </button>
        </div>
      )}
    </div>
  );
}
