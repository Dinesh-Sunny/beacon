"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1_000;

// Seconds left before an action may run again; start() begins a new wait.
export function useCooldown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), TICK_MS);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}
