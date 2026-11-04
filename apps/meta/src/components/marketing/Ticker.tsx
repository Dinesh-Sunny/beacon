"use client";

// Counts a number up once when it scrolls into view. The server renders the final value.

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, useInView } from "./useInView";

export function Ticker({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref);
  const [n, setN] = useState(value);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight) {
      setN(0);
      setArmed(true);
    }
  }, []);

  useEffect(() => {
    if (!seen || !armed) return;
    const start = performance.now();
    const ms = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, armed, value]);

  return (
    <span ref={ref} className="mk-ticker">
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}
