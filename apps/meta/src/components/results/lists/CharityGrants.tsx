"use client";

// Charities that make grants to individuals. Near you: grant-giving charities from the Charity
// Commission register that work in the person's district, county or region and help people like
// them. Then funders from 360Giving's open grant data that gave grants to people recently.

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
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
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\b(Cio|Uk|Nhs|Raf|Ymca|Ywca)\b/g, (w) => w.toUpperCase());

export function CharityGrants() {
  const { answers } = useCheck();
  const t = useTranslations("lists");
  const fmt = useFormatter();
  const month = (iso: string) =>
    fmt.dateTime(new Date(iso), { month: "long", year: "numeric" });
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
          <span className="eyebrow">{t("charitiesNear")}</span>
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
                  {funds?.local.includes(f) ? t("local") : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">
            {t.rich("fromRegister", {
              date: month(funds?.read ?? data.read),
              link: (c) => (
                <a href={funds?.source} target="_blank" rel="noreferrer">
                  {c}
                </a>
              ),
            })}{" "}
            {register.length > 4 && (
              <button
                type="button"
                className="linkbtn"
                onClick={() => setAll((a) => !a)}
                aria-expanded={all}
              >
                {all ? t("fewer") : t("all", { count: register.length })}
              </button>
            )}
          </p>
        </>
      )}
      {national.length > 0 && (
        <>
          <span className="eyebrow">{t("gaveRecently")}</span>
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
            {t.rich("typical", {
              date: month(data.read),
              link: (c) => (
                <a href={data.source} target="_blank" rel="noreferrer">
                  {c}
                </a>
              ),
            })}
          </p>
        </>
      )}
    </div>
  );
}
