"use client";

// Keeps the nation exact for postcodes near a border. The postcode's letters give a first
// guess straight away; the lookup confirms it, and if it differs Beacon re-checks and says so.

import { useEffect, useRef } from "react";
import { NATION, nationOf } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { usePlace } from "@/lib/council";
import { useCountry } from "@/lib/country";
import { useUsPlace } from "@/lib/usplace";

export function PlaceSync() {
  const { answers, refine, announce } = useCheck();
  const { nation } = usePlace(answers.postcode);
  const { country, setCountry } = useCountry();
  const us = useUsPlace(answers.zip);
  // A newly given ZIP code or postcode says which country the person lives in.
  const zip = typeof answers.zip === "string" ? answers.zip : null;
  const pc = typeof answers.postcode === "string" ? answers.postcode : null;
  const where = useRef({ zip, pc });
  useEffect(() => {
    const before = where.current;
    where.current = { zip, pc };
    if (zip && zip !== before.zip && country !== "US") setCountry("US");
    else if (pc && pc !== before.pc && country !== "GB") setCountry("GB");
  }, [zip, pc, country, setCountry]);
  // The place dialog's country decides whose rules the check uses.
  useEffect(() => {
    const c = country === "US" ? "US" : "GB";
    if ((answers.country ?? "GB") !== c) refine({ country: c });
  }, [country, answers.country, refine]);
  // A ZIP code's state, for the state programs.
  useEffect(() => {
    if (us.state && answers.state !== us.state) refine({ state: us.state });
  }, [us.state, answers.state, refine]);
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
