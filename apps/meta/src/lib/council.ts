"use client";

// Which council someone's postcode belongs to, asked once per postcode and shared by every
// component. Used to turn "ask your council" into a link to that council's own page.

import { useEffect, useState } from "react";

export interface Council {
  name: string;
  slug: string;
}

export type PlaceNation = "eng" | "sco" | "wal" | "ni";
export interface LocalLink {
  lgsl: string;
  label: string;
  people: string[];
  scheme?: string;
  url: string;
  by: string;
}
export interface Place {
  council: Council | null;
  nation: PlaceNation | null;
  local: LocalLink[];
}

const known = new Map<string, Promise<Place>>();
const NONE: Place = { council: null, nation: null, local: [] };

function lookup(postcode: string): Promise<Place> {
  const key = postcode.replace(/\s+/g, "").toUpperCase();
  let p = known.get(key);
  if (!p) {
    p = fetch(`/api/council?postcode=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Place>) : NONE))
      .catch(() => NONE);
    known.set(key, p);
  }
  return p;
}

export function usePlace(postcode: unknown): Place {
  const [place, setPlace] = useState<Place>(NONE);
  useEffect(() => {
    setPlace(NONE);
    if (typeof postcode !== "string" || postcode === "unsure") return;
    let live = true;
    void lookup(postcode).then((p) => live && setPlace(p));
    return () => {
      live = false;
    };
  }, [postcode]);
  return place;
}

export const useCouncil = (postcode: unknown): Council | null =>
  usePlace(postcode).council;

/** "London Borough of Brent" reads as "Brent" on a button. */
export const shortCouncil = (name: string) =>
  name
    .replace(
      /^(London Borough of|Royal Borough of|City of|Borough of|Council of the)\s+/i,
      "",
    )
    .replace(
      /\s+(City|County|District|Borough|Metropolitan Borough)?\s*Council$/i,
      "",
    )
    .trim();

/** GOV.UK sends /<service>/<council-slug> straight to that council's page for the service. */
export const councilServiceUrl = (service: string, slug: string) =>
  `https://www.gov.uk/${service}/${slug}`;
