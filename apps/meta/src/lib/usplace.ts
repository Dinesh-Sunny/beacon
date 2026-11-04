"use client";

// A ZIP code's state, city and county, asked once per ZIP and shared by every component.
import { useEffect, useState } from "react";

export interface UsPlace {
  state: string | null;
  stateName: string | null;
  city: string | null;
  county: { fips: string; name: string } | null;
}
const NONE: UsPlace = {
  state: null,
  stateName: null,
  city: null,
  county: null,
};
const known = new Map<string, Promise<UsPlace>>();

export function lookupZip(zip: string): Promise<UsPlace> {
  let p = known.get(zip);
  if (!p) {
    p = fetch(`/api/us/place?zip=${zip}`)
      .then((r) => (r.ok ? (r.json() as Promise<UsPlace>) : NONE))
      .catch(() => NONE);
    known.set(zip, p);
  }
  return p;
}

export function useUsPlace(zip: unknown): UsPlace {
  const [place, setPlace] = useState<UsPlace>(NONE);
  useEffect(() => {
    setPlace(NONE);
    if (typeof zip !== "string" || !/^\d{5}$/.test(zip)) return;
    let live = true;
    void lookupZip(zip).then((p) => live && setPlace(p));
    return () => {
      live = false;
    };
  }, [zip]);
  return place;
}
