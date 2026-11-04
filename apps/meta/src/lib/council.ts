"use client";

// Which council someone's postcode belongs to, asked once per postcode and shared by every
// component. Used to turn "ask your council" into a link to that council's own page.

import { useEffect, useState } from "react";

export interface Council {
  name: string;
  slug: string;
}

const known = new Map<string, Promise<Council | null>>();

function lookup(postcode: string): Promise<Council | null> {
  const key = postcode.replace(/\s+/g, "").toUpperCase();
  let p = known.get(key);
  if (!p) {
    p = fetch(`/api/council?postcode=${encodeURIComponent(key)}`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ council: Council | null }>)
          : { council: null },
      )
      .then((j) => j.council)
      .catch(() => null);
    known.set(key, p);
  }
  return p;
}

export function useCouncil(postcode: unknown): Council | null {
  const [council, setCouncil] = useState<Council | null>(null);
  useEffect(() => {
    setCouncil(null);
    if (typeof postcode !== "string" || postcode === "unsure") return;
    let live = true;
    void lookup(postcode).then((c) => live && setCouncil(c));
    return () => {
      live = false;
    };
  }, [postcode]);
  return council;
}

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
