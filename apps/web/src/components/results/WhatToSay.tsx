"use client";

import type { Finding } from "@beacon/rules";
import { useState } from "react";
import { Icon } from "../Icon";
import { Listen } from "./Listen";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; text: string }
  | { kind: "error"; message: string };

/** Beam writes next steps and a call script or letter for this result, on request. */
export function WhatToSay({ finding }: { finding: Finding }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const ask = async (): Promise<void> => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finding),
      });
      const body = (await res.json().catch(() => ({}))) as {
        text?: string;
        message?: string;
      };
      if (!res.ok || !body.text)
        throw new Error(
          body.message ?? "We couldn't write this just now. Please try again.",
        );
      setState({ kind: "done", text: body.text });
    } catch (error) {
      setState({ kind: "error", message: (error as Error).message });
    }
  };

  if (state.kind === "idle" || state.kind === "loading")
    return (
      <button
        type="button"
        className="btn sec self-start no-print"
        onClick={() => void ask()}
        disabled={state.kind === "loading"}
        aria-busy={state.kind === "loading"}
      >
        {state.kind === "loading" ? (
          <>
            <span className="spin" aria-hidden="true" /> Writing it for you
          </>
        ) : (
          "Help me with what to say"
        )}
      </button>
    );

  if (state.kind === "error")
    return (
      <div className="banner" role="alert">
        <span>{state.message}</span>
        <button type="button" className="btn txt" onClick={() => void ask()}>
          Try again
        </button>
      </div>
    );

  return (
    <section className="card stack gap-3" aria-labelledby="say-title">
      <h3 id="say-title" className="t-title">
        What to say
      </h3>
      <p className="small muted">
        Written for you by the Beam model from the official claim details. Check
        it before you use it.
      </p>
      <div className="whitespace-pre-line">{state.text}</div>
      <div className="acts">
        <button
          type="button"
          className="btn sec no-print"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Icon name={copied ? "check" : "copy"} />
          {copied ? "Copied" : "Copy it"}
        </button>
        <Listen text={state.text} />
      </div>
    </section>
  );
}
