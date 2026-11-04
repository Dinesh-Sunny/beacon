"use client";

// Live lists a pack can attach to a scheme with its "list" field.
import type { Nation, Scheme } from "@/engine/rules";
import { CharityGrants } from "./CharityGrants";
import { SocialTariffs } from "./SocialTariffs";

export function SchemeList({
  s,
  nation,
}: {
  s: Scheme;
  nation: Nation | null;
}) {
  if (s.list === "socialTariffs") return <SocialTariffs nation={nation} />;
  if (s.list === "charityGrants") return <CharityGrants />;
  return null;
}
