"use client";

import type { CheckEvent, Finding } from "@beacon/rules";
import { createContext, type ReactNode, useContext, useState } from "react";
import { type Draft, emptyDraft } from "./answers";

export type Usage = Extract<CheckEvent, { type: "usage" }>;

export interface Results {
  findings: Finding[];
  usage: Usage[];
  model?: string;
  snapshot?: boolean;
}

interface Store {
  draft: Draft;
  setDraft: (next: Draft | ((d: Draft) => Draft)) => void;
  results: Results | null;
  setResults: (r: Results | null) => void;
}

const Ctx = createContext<Store | null>(null);

// One check per tab, in memory only. Leaving the page or closing the tab drops it.
export function CheckProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [results, setResults] = useState<Results | null>(null);
  return <Ctx value={{ draft, setDraft, results, setResults }}>{children}</Ctx>;
}

export function useCheck(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useCheck needs CheckProvider");
  return s;
}
