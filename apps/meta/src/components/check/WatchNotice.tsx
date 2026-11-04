"use client";

// The Watch step of the Beacon Framework, with no server: this browser remembers what looked
// likely and which rules it was checked against. When the person comes back after the packs
// have grown or changed, Beacon says what's new for them, once.

import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { byId, REGISTRY } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

const KEY = "beacon:seen:v1";

export function WatchNotice() {
  const { hydrated, states, answers, announce } = useCheck();
  const t = useTranslations("watch");
  const done = useRef(false);
  useEffect(() => {
    if (!hydrated || done.current || !Object.keys(answers).length) return;
    done.current = true;
    const likely = Object.keys(states).filter(
      (id) => states[id]?.status === "likely" || states[id]?.status === "check",
    );
    try {
      const seen = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
        version: string;
        ids: string[];
      } | null;
      if (seen && seen.version !== REGISTRY.version) {
        const fresh = likely
          .filter((id) => !seen.ids.includes(id))
          .map((id) => byId[id]?.name)
          .filter(Boolean);
        if (fresh.length) announce(t("newRules", { names: fresh.join(", ") }));
      }
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: REGISTRY.version, ids: likely }),
      );
    } catch {
      /* nothing to compare */
    }
  }, [hydrated, states, answers, announce, t]);
  // Keep the record current as answers change, so the next visit compares like with like.
  useEffect(() => {
    if (!hydrated || !done.current) return;
    const ids = Object.keys(states).filter(
      (id) => states[id]?.status === "likely" || states[id]?.status === "check",
    );
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: REGISTRY.version, ids }),
      );
    } catch {
      /* memory only */
    }
  }, [hydrated, states]);
  return null;
}
