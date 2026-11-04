"use client";

// The person's own council pages for local services that fit their situation (care, adaptations,
// school transport, homelessness help and more), from GOV.UK Local Links Manager. Folded behind
// one button; services a scheme above already checks are left out.

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { peopleGroups } from "@/engine/rules";
import { useCheck } from "@/lib/check-store";
import { shortCouncil, usePlace } from "@/lib/council";

export function LocalHelp() {
  const { answers } = useCheck();
  const { local } = usePlace(answers.postcode);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const groups = useMemo(() => peopleGroups(answers), [answers]);
  // Closest fit first: services that match more of the person's groups lead.
  const fit = (people: string[]) =>
    people.filter((p) => groups.includes(p)).length;
  const list = local
    .filter((l) => !l.scheme && fit(l.people) > 0)
    .sort((a, b) => fit(b.people) - fit(a.people));
  if (!list.length) return null;
  const by = [...new Set(list.map((l) => shortCouncil(l.by)))].join(" and ");
  return (
    <section className="more-help" aria-labelledby="local-h">
      <button
        type="button"
        className="linkbtn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="local-help"
      >
        <Icon name="pin" size={16} />{" "}
        <span id="local-h">
          {list.length} services from {by} that may fit
        </span>
      </button>
      {open && (
        <div className="more-body">
          <ul>
            {(all ? list : list.slice(0, 5)).map((l) => (
              <li key={l.lgsl}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          {!all && list.length > 5 && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => setAll(true)}
            >
              Show all {list.length}
            </button>
          )}
          <p className="hint">
            Each link goes to the council's own page, listed on{" "}
            <a
              href="https://local-links-manager.publishing.service.gov.uk/"
              target="_blank"
              rel="noreferrer"
            >
              GOV.UK
            </a>
            .
          </p>
        </div>
      )}
    </section>
  );
}
