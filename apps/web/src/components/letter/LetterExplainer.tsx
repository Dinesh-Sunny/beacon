"use client";

import { LIMITS } from "@beacon/brain/config";
import Link from "next/link";
import { useRef, useState } from "react";
import { SITE } from "@/lib/site";
import { Icon } from "../Icon";
import { Listen } from "../results/Listen";
import { SectionedText } from "../results/SectionedText";

const MAX = LIMITS.letterChars;
const MIN = 40;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; text: string; removed: number }
  | { kind: "error"; message: string };

export function LetterExplainer() {
  const [letter, setLetter] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const result = useRef<HTMLHeadingElement>(null);

  const explain = async (): Promise<void> => {
    if (letter.trim().length < MIN) {
      setState({
        kind: "error",
        message: "Paste a bit more of the letter so we can read it.",
      });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ letter }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        text?: string;
        removed?: number;
        message?: string;
      };
      if (!res.ok || !body.text)
        throw new Error(
          body.message ?? "We couldn't read your letter just now.",
        );
      setState({ kind: "done", text: body.text, removed: body.removed ?? 0 });
      requestAnimationFrame(() => result.current?.focus());
    } catch (error) {
      setState({ kind: "error", message: (error as Error).message });
    }
  };

  return (
    <div className="wrap stack max-w-[760px] gap-8">
      <header className="stack gap-3">
        <h1 className="d2">Explain my letter</h1>
        <p className="lead">
          Got a letter about benefits, council tax or energy help? Paste the
          words and Beacon tells you what it means and what to do next.
        </p>
      </header>

      <div className="banner info">
        <Icon name="lock" className="mt-0.5 flex-none" />
        <span>
          Leave out your name and address. We remove National Insurance numbers
          and account numbers before the letter is read, and nothing is kept.
        </span>
      </div>

      <div className="stack gap-2">
        <label htmlFor="letter" className="font-bold">
          The words from your letter
        </label>
        <textarea
          id="letter"
          className="input min-h-[240px] w-full resize-y"
          rows={10}
          maxLength={MAX}
          value={letter}
          aria-describedby="letter-count"
          onChange={(e) => setLetter(e.target.value)}
        />
        <p id="letter-count" className="small muted">
          {letter.length.toLocaleString("en-GB")} of{" "}
          {MAX.toLocaleString("en-GB")} letters
        </p>
      </div>

      <div className="acts">
        <button
          type="button"
          className="btn pri"
          onClick={() => void explain()}
          disabled={state.kind === "loading"}
          aria-busy={state.kind === "loading"}
        >
          {state.kind === "loading" ? (
            <>
              <span className="spin" aria-hidden="true" /> Reading your letter
            </>
          ) : (
            "Explain this letter"
          )}
        </button>
      </div>

      {state.kind === "error" && (
        <div className="err-summary" role="alert">
          <p>{state.message}</p>
        </div>
      )}

      {state.kind === "done" && (
        <section className="card stack gap-4" aria-labelledby="explained">
          <h2
            id="explained"
            ref={result}
            tabIndex={-1}
            className="h-m outline-none"
          >
            What your letter means
          </h2>
          {state.removed > 0 && (
            <p className="small muted">
              We removed {state.removed} number
              {state.removed === 1 ? "" : "s"} before reading it.
            </p>
          )}
          <SectionedText text={state.text} />
          <p className="small muted">
            Written by the Beam model from your letter only. It is guidance, not
            advice. For help with a decision, talk to a free adviser.
          </p>
          <div className="acts">
            <Listen text={state.text} />
            <a
              className="btn txt"
              href={SITE.freeHelpUrl}
              target="_blank"
              rel="noreferrer"
            >
              Find free help
            </a>
          </div>
        </section>
      )}

      <p className="small muted">
        Want to know what support may be yours?{" "}
        <Link href="/check">Start my check</Link>
      </p>
    </div>
  );
}
