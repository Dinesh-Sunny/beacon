"use client";

// Help the harvest found on GOV.UK that the rules can't screen yet, matched to this person's
// Beacon Framework groups and nation. Folded away behind one button and loaded only when
// opened, so the results stay calm and the page stays light.

import { useMemo, useState } from "react";
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

const KIND: Record<string, string> = {
  payment: "Payment",
  grant: "Grant",
  discount: "Discount",
  free: "Free",
  loan: "Loan",
  tax: "Tax relief",
  credit: "Credit",
  register: "Register",
  concession: "Concession",
  compensation: "Compensation",
  unclaimed: "Unclaimed money",
  advice: "Advice",
};

export function MoreHelp() {
  const { answers } = useCheck();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
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
        <span id="more-h">More help to look at</span>
      </button>
      {open && rows && (
        <div className="more-body">
          <p className="hint">
            Found on GOV.UK for people in a similar situation. Beacon can't
            check these for you yet, so each links to its official page.
          </p>
          <label htmlFor="more-q" className="sr-only">
            Search more help
          </label>
          <input
            id="more-q"
            className="txt"
            placeholder="Search, like energy or school"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul>
            {matches.slice(0, 40).map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name}
                </a>
                {r.kind && (
                  <span className="chip">{KIND[r.kind] ?? r.kind}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="hint">
            {matches.length
              ? `${Math.min(matches.length, 40)} of ${matches.length} shown`
              : "Nothing matches that search."}
          </p>
        </div>
      )}
    </section>
  );
}
