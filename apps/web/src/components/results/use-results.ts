"use client";

import { useEffect, useState } from "react";
import { encodeFragment, parseResults, readFragment } from "@/lib/answers";
import { type Results, useCheck } from "@/lib/check-store";

/**
 * Results from this tab's check, or from a private link (#r=...). The link carries the results
 * only, never the answers, so it is safe to share.
 */
export function useResults(): {
  results: Results | null;
  ready: boolean;
  shareUrl: string;
} {
  const { results, setResults } = useCheck();
  const [ready, setReady] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!results) {
      const saved = parseResults(readFragment(window.location.hash, "r"));
      if (saved)
        setResults({
          findings: saved.findings,
          usage: [],
          model: saved.model,
          fromLink: true,
        });
    }
    setReady(true);
  }, [results, setResults]);

  useEffect(() => {
    if (!results) return;
    const frag = encodeFragment("r", {
      findings: results.findings,
      model: results.model,
    });
    setShareUrl(`${window.location.origin}/results#${frag}`);
    if (window.location.pathname === "/results")
      window.history.replaceState(null, "", `#${frag}`);
  }, [results]);

  return { results, ready, shareUrl };
}
