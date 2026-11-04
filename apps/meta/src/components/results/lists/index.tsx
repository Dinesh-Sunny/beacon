"use client";

// Live lists a pack can attach to a scheme with its "list" field.
import type { Nation, Scheme } from "@/engine/rules";
import { SocialTariffs } from "./SocialTariffs";

export function SchemeList({
  s,
  nation,
}: {
  s: Scheme;
  nation: Nation | null;
}) {
  if (s.list === "socialTariffs") return <SocialTariffs nation={nation} />;
  return null;
}
