"use client";

// The hero's product frame: an example check that plays itself once in view, then loops gently.
// Decorative only (aria-hidden); the real input is HomeStart beside it.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Icon, Logo } from "@/components/Icon";
import { prefersReducedMotion, useInView } from "./useInView";

// Scheme names are official names, so they stay in English; the tags use the shared status words.
type Row = { name: string; kind: "likely" | "check" | "unlock" };

const ROWS: Row[] = [
  { name: "Attendance Allowance", kind: "likely" },
  { name: "Pension Credit", kind: "likely" },
  { name: "Council Tax Reduction", kind: "check" },
  { name: "Free TV licence", kind: "unlock" },
];

// Beat at which each piece appears (one beat = 0.8s).
const AT = {
  you1: 1,
  typing1: 2,
  ask: 3,
  you2: 5,
  rows: 6,
  note: 11,
  call: 13,
  end: 20,
};

export function ChatDemo() {
  const t = useTranslations("home.demo");
  const ts = useTranslations("status");
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, "0px");
  const [beat, setBeat] = useState(AT.end);

  useEffect(() => {
    if (!seen || prefersReducedMotion()) return;
    setBeat(0);
    const id = window.setInterval(
      () => setBeat((b) => (b >= AT.end ? 0 : b + 1)),
      800,
    );
    return () => window.clearInterval(id);
  }, [seen]);

  const on = (at: number) => (beat >= at ? " on" : "");

  return (
    <div className="mk-demo" ref={ref} aria-hidden="true">
      <div className="mk-demo-glow" />
      <div className="mk-demo-frame">
        <div className="mk-demo-bar">
          <Logo size={20} />
          <b>Beacon</b>
          <span className="mk-demo-tag">{t("tag")}</span>
        </div>
        <div className="mk-demo-body">
          <p className={`mk-bubble you${on(AT.you1)}`}>{t("you1")}</p>
          <div className="mk-slot">
            <p
              className={`mk-bubble beacon mk-typing${beat >= AT.typing1 && beat < AT.ask ? " on" : ""}`}
            >
              <i />
              <i />
              <i />
            </p>
            <p className={`mk-bubble beacon${on(AT.ask)}`}>{t("ask")}</p>
          </div>
          <p className={`mk-bubble you${on(AT.you2)}`}>{t("you2")}</p>
          <div className="mk-demo-results">
            {ROWS.map((r, i) => (
              <div
                key={r.name}
                className={`mk-row ${r.kind}${on(AT.rows + i)}`}
              >
                <span>{r.name}</span>
                <em>{ts(r.kind)}</em>
              </div>
            ))}
          </div>
          <p className={`mk-demo-note${on(AT.note)}`}>
            <Icon name="spark" size={16} /> {t("note")}
          </p>
          <p className={`mk-demo-call${on(AT.call)}`}>
            <Icon name="phone" size={16} /> <span>{t("call")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
