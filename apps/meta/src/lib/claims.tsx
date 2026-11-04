"use client";

// The Confirm and Receive steps of the Beacon Framework: what the person has done about each
// claim (applied, awarded, refused), kept in this browser only. An award of a gateway benefit
// is fed back into the answers, so the help it opens moves from "unlocks next" to "likely".

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useCheck } from "./check-store";

export type ClaimState = "applied" | "awarded" | "refused";
export interface Claim {
  state: ClaimState;
  at: number;
}
type Claims = Record<string, Claim>;

const KEY = "beacon:claims:v1";
const Ctx = createContext<{ claims: Claims; setClaim: (id: string, state: ClaimState | null) => void } | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const { resets } = useCheck();
  const [claims, setClaims] = useState<Claims>({});
  useEffect(() => {
    try {
      setClaims(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Claims);
    } catch {
      /* memory only */
    }
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear on start again
  useEffect(() => {
    if (resets) setClaims({});
  }, [resets]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(claims));
    } catch {
      /* memory only */
    }
  }, [claims]);
  const setClaim = useCallback((id: string, state: ClaimState | null) => {
    setClaims((c) => {
      const { [id]: _drop, ...rest } = c;
      return state ? { ...rest, [id]: { state, at: Date.now() } } : rest;
    });
  }, []);
  return <Ctx.Provider value={{ claims, setClaim }}>{children}</Ctx.Provider>;
}

export function useClaims() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useClaims needs ClaimsProvider");
  return c;
}
