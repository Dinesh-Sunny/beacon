"use client";

// Help near a US ZIP code, nearest first: community health centers (HRSA), the local public
// housing agency (HUD) and HUD-approved housing counselors. Folded behind one button each.

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { useCheck } from "@/lib/check-store";

interface Service {
  name: string;
  address: string;
  phone: string | null;
  web: string | null;
  miles: number;
  note: string;
}
interface UsLocal {
  health: Service[];
  housing: Service[];
  counselors: Service[];
  inState: Record<"health" | "housing" | "counselors", number>;
}
type Kind = keyof UsLocal["inState"];
const KINDS: { kind: Kind; icon: string; source: string }[] = [
  {
    kind: "health",
    icon: "shield",
    source: "https://findahealthcenter.hrsa.gov/",
  },
  {
    kind: "housing",
    icon: "pin",
    source:
      "https://www.hud.gov/helping-americans/public-housing-agency-contacts",
  },
  {
    kind: "counselors",
    icon: "chat",
    source: "https://www.hud.gov/counseling",
  },
];

export function UsLocalHelp() {
  const { answers } = useCheck();
  const zip = typeof answers.zip === "string" ? answers.zip : null;
  const [data, setData] = useState<UsLocal | null>(null);
  useEffect(() => {
    setData(null);
    if (!zip) return;
    const ctl = new AbortController();
    fetch(`/api/us/local?zip=${zip}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<UsLocal>) : null))
      .then(setData)
      .catch(() => {});
    return () => ctl.abort();
  }, [zip]);
  if (!data) return null;
  return (
    <>
      {KINDS.map(({ kind, icon, source }) =>
        data[kind].length ? (
          <Group
            key={kind}
            kind={kind}
            icon={icon}
            source={source}
            list={data[kind]}
            total={data.inState[kind]}
          />
        ) : null,
      )}
    </>
  );
}

function Group({
  kind,
  icon,
  source,
  list,
  total,
}: {
  kind: Kind;
  icon: string;
  source: string;
  list: Service[];
  total: number;
}) {
  const t = useTranslations("usLocal");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  return (
    <section className="more-help" aria-labelledby={`us-${kind}`}>
      <button
        type="button"
        className="linkbtn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`us-${kind}`}
      >
        <Icon name={icon} size={16} />{" "}
        <span id={`us-${kind}`}>{t(`${kind}.title`, { count: total })}</span>
      </button>
      {open && (
        <div className="more-body">
          <p>{t(`${kind}.what`)}</p>
          <ul className="us-local">
            {list.map((s) => (
              <li key={`${s.name}-${s.address}`}>
                <b>
                  {s.web ? (
                    <a href={s.web} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </b>
                <span className="hint">
                  {t("away", {
                    miles: format.number(s.miles, {
                      maximumFractionDigits: 1,
                    }),
                  })}
                  {s.note && kind !== "counselors"
                    ? ` · ${t(`note.${s.note}` as "note.mobile")}`
                    : ""}
                </span>
                <span>{s.address}</span>
                {kind === "counselors" && s.note && (
                  <span className="hint">
                    {s.note
                      .split("|")[0]
                      ?.split(" ")
                      .filter(Boolean)
                      .map((h) => t(`helps.${h}` as "helps.rent"))
                      .join(", ")}
                  </span>
                )}
                {s.phone && (
                  <a href={`tel:+1${s.phone.replace(/-/g, "")}`}>{s.phone}</a>
                )}
              </li>
            ))}
          </ul>
          <p className="hint">
            {t(`${kind}.note`, { count: total })}{" "}
            <a href={source} target="_blank" rel="noreferrer">
              {t(`${kind}.more`)}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
