"use client";

// The hero's sky: a soft beacon glow rising behind the headline, slow drifting clouds, and a few
// glass cards from a real check floating in them. The cards lean gently with the pointer.
// Decorative only (aria-hidden); the real input is HomeStart. Still for reduced motion and Calmer.

import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { Icon, Logo } from "@/components/Icon";
import { prefersReducedMotion } from "./useInView";

// Scheme names are official names, so they stay in English; tags use the shared status words.
const ROWS = [
  { name: "Attendance Allowance", kind: "likely" },
  { name: "Pension Credit", kind: "likely" },
  { name: "Council Tax Reduction", kind: "check" },
] as const;

export function HeroSky() {
  const t = useTranslations("home.demo");
  const ts = useTranslations("status");
  const ref = useRef<HTMLDivElement>(null);

  // Pointer parallax: one rAF-throttled pair of CSS variables; each card scales them by its depth.
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !matchMedia("(pointer: fine)").matches)
      return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
        el.style.setProperty(
          "--py",
          (e.clientY / innerHeight - 0.5).toFixed(3),
        );
      });
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hs-sky" ref={ref} aria-hidden="true">
      <div className="hs-glow" />
      <div className="hs-rays" />
      <div className="hs-cloud c1" />
      <div className="hs-cloud c2" />
      <div className="hs-cloud c3" />
      <div className="hs-cloud c4" />
      <div className="hs-cloud c5" />

      <div
        className="hs-card hs-you"
        style={{ "--d": 18 } as React.CSSProperties}
      >
        <p>{t("you1")}</p>
      </div>
      <div
        className="hs-card hs-results"
        style={{ "--d": 30 } as React.CSSProperties}
      >
        <div className="hs-bar">
          <Logo size={16} />
          <b>Beacon</b>
        </div>
        {ROWS.map((r, i) => (
          <div
            key={r.name}
            className={`hs-row ${r.kind}`}
            style={{ animationDelay: `${0.9 + i * 0.25}s` }}
          >
            <span>{r.name}</span>
            <em>{ts(r.kind)}</em>
          </div>
        ))}
      </div>
      <div
        className="hs-card hs-note"
        style={{ "--d": 24 } as React.CSSProperties}
      >
        <Icon name="spark" size={16} />
        <span>{t("note")}</span>
      </div>
      <div
        className="hs-card hs-call"
        style={{ "--d": 14 } as React.CSSProperties}
      >
        <Icon name="phone" size={16} />
        <span>{t("call")}</span>
      </div>
    </div>
  );
}
