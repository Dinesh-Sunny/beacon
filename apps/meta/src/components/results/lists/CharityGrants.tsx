"use client";

// Charities that make grants to individuals, from 360Giving's open grant data: funders that
// give across the country, plus local ones whose grants went to the person's council area.

import data from "@/data/charity-grants.json";
import { peopleGroups } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { shortCouncil, useCouncil } from "@/lib/council";

const readOn = new Date(data.read).toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
});

export function CharityGrants() {
  const { answers } = useCheck();
  const council = useCouncil(answers.postcode);
  const area = council ? shortCouncil(council.name).toLowerCase() : null;
  const local = area
    ? data.funders.filter(
        (f) =>
          !f.national && f.places.some((p) => p.toLowerCase().includes(area)),
      )
    : [];
  const list = [...local, ...data.funders.filter((f) => f.national)].slice(
    0,
    5,
  );
  if (!list.length) return null;
  return (
    <div className="mini-list">
      <span className="eyebrow">
        Charities that gave grants to people recently
      </span>
      <ul>
        {list.map((f) => (
          <li key={f.name}>
            <span>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
              ) : (
                f.name
              )}
              {f.programmes.length > 0 && (
                <span className="hint">
                  {" "}
                  · {f.programmes.slice(0, 2).join(", ")}
                </span>
              )}
            </span>
            <span className="hint">{local.includes(f) ? "Near you" : ""}</span>
            {f.typical ? (
              <b>£{Math.round(f.typical).toLocaleString("en-GB")}</b>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      <p className="hint">
        Typical grant, from{" "}
        <a href={data.source} target="_blank" rel="noreferrer">
          360Giving
        </a>{" "}
        open data, read {readOn}.
      </p>
    </div>
  );
}
