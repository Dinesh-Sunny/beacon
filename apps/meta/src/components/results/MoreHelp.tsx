"use client";

// Help the harvest found on GOV.UK that the rules can't screen yet, matched to this person's
// Beacon Framework groups and nation. Folded away behind one button and loaded only when
// opened, so the results stay calm and the page stays light.

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { type Nation, nationIn, peopleGroups } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";

interface Row {
  name: string;
  title: string;
  url: string;
  kind: string | null;
  people: string[];
  nations: string[];
}

export function MoreHelp() {
  const { answers } = useCheck();
  const t = useTranslations("results");
  const tm = useTranslations("more");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const groups = useMemo(() => peopleGroups(answers), [answers]);
  const nation: Nation | null = nationIn(answers);

  const matches = useMemo(() => {
    if (!rows) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const overlap = (r: Row) =>
      r.people.filter((p) => groups.includes(p)).length;
    return rows
      .filter(
        (r) =>
          (!nation || !r.nations.length || r.nations.includes(nation)) &&
          (words.length
            ? words.every((w) =>
                `${r.name} ${r.title}`.toLowerCase().includes(w),
              )
            : overlap(r) > 0),
      )
      .sort((a, b) => overlap(b) - overlap(a));
  }, [rows, q, groups, nation]);

  if (!groups.length) return null;
  const toggle = async () => {
    if (!rows)
      setRows((await import("@/data/more-help.json")).default as Row[]);
    setOpen((o) => !o);
  };

  return (
    <section className="more-help" aria-labelledby="more-h">
      <button
        type="button"
        className="linkbtn"
        onClick={() => void toggle()}
        aria-expanded={open}
        data-testid="more-help"
      >
        <Icon name="search" size={16} />{" "}
        <span id="more-h">{t("moreHelp")}</span>
      </button>
      {open && rows && (
        <div className="more-body">
          <p className="hint">{tm("intro")}</p>
          {all && (
            <>
              <label htmlFor="more-q" className="sr-only">
                {tm("search")}
              </label>
              <input
                id="more-q"
                className="txt"
                placeholder={tm("searchHint")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </>
          )}
          <ul>
            {matches.slice(0, all ? 60 : 5).map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name}
                </a>
                {r.kind && (
                  <span className="kind">
                    {tm.has(`kind.${r.kind}` as "kind.grant")
                      ? tm(`kind.${r.kind}` as "kind.grant")
                      : r.kind}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!all && matches.length > 5 ? (
            <button
              type="button"
              className="linkbtn"
              onClick={() => setAll(true)}
            >
              {tm("showAll", { count: matches.length })}
            </button>
          ) : (
            <p className="hint">
              {matches.length
                ? tm("shown", {
                    shown: Math.min(matches.length, 60),
                    total: matches.length,
                  })
                : tm("noMatch")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
