"use client";

// Charities that make grants to individuals. Near you: grant-giving charities from the Charity
// Commission register that work in the person's district, county or region and help people like
// them. Then funders from 360Giving's open grant data that gave grants to people recently.

import { useEffect, useMemo, useState } from "react";
import data from "@/data/charity-grants.json";
import { peopleGroups } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

interface Fund {
  n: string;
  name: string;
  web: string | null;
  does: string;
}
interface Funds {
  local: Fund[];
  wide: Fund[];
  read: string;
  source: string;
}

const month = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const link = (f: Fund) =>
  f.web
    ? /^https?:\/\//i.test(f.web)
      ? f.web
      : `https://${f.web}`
    : `https://findthatcharity.uk/orgid/GB-CHC-${f.n}`;
// The register stores names in capitals; read them as a name.
const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(And|Of|The|For|In|To)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());

export function CharityGrants() {
  const { answers } = useCheck();
  const groups = useMemo(() => peopleGroups(answers).join(","), [answers]);
  const postcode =
    typeof answers.postcode === "string" && answers.postcode !== "unsure"
      ? answers.postcode
      : null;
  const [funds, setFunds] = useState<Funds | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!postcode || !groups) return;
    let live = true;
    void fetch(
      `/api/charities?postcode=${encodeURIComponent(postcode)}&groups=${groups}`,
    )
      .then((r) => (r.ok ? (r.json() as Promise<Funds>) : null))
      .then((f) => live && setFunds(f))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [postcode, groups]);

  const register = [...(funds?.local ?? []), ...(funds?.wide ?? [])];
  const shown = all ? register : register.slice(0, 4);
  const national = data.funders.filter((f) => f.national).slice(0, 3);

  return (
    <div className="mini-list">
      {register.length > 0 && (
        <>
          <span className="eyebrow">Charities that give grants near you</span>
          <ul className="funds">
            {shown.map((f) => (
              <li key={f.n}>
                <span>
                  <a href={link(f)} target="_blank" rel="noreferrer">
                    {title(f.name)}
                  </a>
                  {f.does && <span className="hint fund-does">{f.does}</span>}
                </span>
                <span className="hint">
                  {funds?.local.includes(f) ? "Local" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">
            From the{" "}
            <a href={funds?.source} target="_blank" rel="noreferrer">
              Charity Commission register
            </a>
            , {month(funds?.read ?? data.read)}. Each sets its own rules.{" "}
            {register.length > 4 && (
              <button
                type="button"
                className="linkbtn"
                onClick={() => setAll((a) => !a)}
                aria-expanded={all}
              >
                {all ? "Show fewer" : `All ${register.length}`}
              </button>
            )}
          </p>
        </>
      )}
      {national.length > 0 && (
        <>
          <span className="eyebrow">Gave grants to people recently</span>
          <ul>
            {national.map((f) => (
              <li key={f.name}>
                <span>
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.name}
                    </a>
                  ) : (
                    f.name
                  )}
                </span>
                <span />
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
            open data, read {month(data.read)}.
          </p>
        </>
      )}
    </div>
  );
}
