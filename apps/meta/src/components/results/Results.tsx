"use client";

import { count } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

export function Results() {
  const { states } = useCheck();
  return (
    <section className="qcard" data-testid="results">
      <h2>{count(states, "likely")} things look like yours</h2>
    </section>
  );
}
