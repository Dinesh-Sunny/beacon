"use client";

import {
  type CheckEvent,
  type Finding,
  rankFindings,
  type SchemeId,
  schemeById,
  VERDICT_LABEL,
  type Verdict,
} from "@beacon/rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { situationForCheck } from "@/lib/answers";
import { type Usage, useCheck } from "@/lib/check-store";
import { Icon } from "../Icon";
import { VerdictBar } from "../Verdict";
import { type ReadEntry, ReaderBoard, type RowStatus } from "./ReaderBoard";

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

export function headline(findings: Finding[], forSomeoneElse = false): string {
  const likely = findings.filter((f) => f.verdict === "likely").length;
  const worth = findings.filter((f) => f.verdict === "worth-checking").length;
  if (likely > 0)
    return `${likely} ${likely === 1 ? "looks" : "look"} likely for ${forSomeoneElse ? "them" : "you"}`;
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
  const [feed, setFeed] = useState<ReadEntry[]>([]);
  const feedId = useRef(1);
  const say = (
    who: ReadEntry["who"],
    text: string,
    source?: ReadEntry["source"],
  ) =>
    setFeed((f) =>
      [{ id: feedId.current++, who, text, source }, ...f].slice(0, 12),
    );
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
    setFeed([]);
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
              "We couldn't connect just now. Your answers are safe in this browser.",
          );
          return;
        }
        for await (const e of readEvents(res)) {
          if (e.type === "precheck") {
            setTotal(e.items.length);
            const open = e.items.filter((i) => i.status === "open").length;
            say(
              "rules",
              `Settled ${e.items.length - open} kinds of support from the rules in code. Sending ${open} to Beam readers.`,
            );
          } else if (e.type === "plan") {
            setPlan(e.schemes);
            setRows(Object.fromEntries(e.schemes.map((s) => [s, "waiting"])));
          } else if (e.type === "reading") {
            setRows((r) => ({ ...r, [e.scheme]: e.status }));
            const s = schemeById(e.scheme);
            const page = {
              label: e.title ? `GOV.UK: ${e.title}` : `GOV.UK: ${s.name}`,
              url: e.url ?? `https://www.gov.uk${s.govukPaths[0] ?? ""}`,
            };
            if (e.status === "reading")
              say("beam", `Opened the official ${s.name} page.`);
            else if (e.status === "done")
              say(
                "beam",
                `Read the whole ${s.name} page. Judging it against your answers.`,
                page,
              );
            else
              say(
                "beam",
                `Couldn't open the ${s.name} page. It will say Worth checking.`,
                page,
              );
          } else if (e.type === "finding") {
            const s = schemeById(e.finding.scheme);
            if (e.finding.quoteVerified)
              say(
                "checker",
                `${s.name}: found the rule line word for word on the page. ${VERDICT_LABEL[e.finding.verdict]}.`,
                { label: `GOV.UK: ${s.name}`, url: e.finding.source.url },
              );
            else if (
              e.finding.verdict === "likely" ||
              e.finding.verdict === "worth-checking"
            )
              say(
                "checker",
                `${s.name}: no exact rule line, so it stays Worth checking.`,
              );
            else
              say(
                "rules",
                `${s.name}: ${VERDICT_LABEL[e.finding.verdict]}. ${e.finding.why}`,
              );
            got = [
              ...got.filter((f) => f.scheme !== e.finding.scheme),
              e.finding,
            ];
            setFindings(got);
          } else if (e.type === "usage") {
            usage.push(e);
            if (e.scheme)
              say(
                "beam",
                `${schemeById(e.scheme).name}: thought at ${e.effort} effort, ${(e.inputTokens + e.outputTokens).toLocaleString("en-GB")} tokens.`,
              );
          } else if (e.type === "error") setProblem(e.message);
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
          setProblem(
            "We couldn't connect just now. Your answers are safe in this browser.",
          );
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
    <div className="wrap stack max-w-[1000px] gap-8">
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
            {headline(findings, draft.situation.forSomeoneElse)}
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
          <h2 className="t-title">We couldn&apos;t read the rules just now</h2>
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
                    unread: plan.filter(
                      (s) => !findings.some((f) => f.scheme === s),
                    ),
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

      {(plan.length > 0 || findings.length > 0) && (
        <ReaderBoard
          plan={plan}
          rows={
            problem
              ? Object.fromEntries(
                  Object.entries(rows).map(([k, v]) => [
                    k,
                    v === "done" ? v : "failed",
                  ]),
                )
              : rows
          }
          findings={findings}
          feed={feed}
        />
      )}
      <p className="sr-only" role="status">
        {doneCount} of {plan.length} read
      </p>

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
