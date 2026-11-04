"use client";

// Keeps the nation exact for postcodes near a border. The postcode's letters give a first
// guess straight away; the lookup confirms it, and if it differs Beacon re-checks and says so.

import { useEffect } from "react";
import { NATION, nationOf } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { usePlace } from "@/lib/council";

export function PlaceSync() {
  const { answers, refine, announce } = useCheck();
  const { nation } = usePlace(answers.postcode);
  useEffect(() => {
    if (
      !nation ||
      typeof answers.postcode !== "string" ||
      answers.nation === nation
    )
      return;
    refine({ nation });
    if (nationOf(answers.postcode) !== nation)
      announce(
        `That postcode is in ${NATION[nation]}, so Beacon has checked the rules there.`,
      );
  }, [nation, answers.postcode, answers.nation, refine, announce]);
  return null;
}
