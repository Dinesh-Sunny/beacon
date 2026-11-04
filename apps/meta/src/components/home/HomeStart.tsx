"use client";

// The home page's main input: whatever you type here opens the check with the agent already
// reading it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";

export function HomeStart() {
  const tr = useTranslations("site");
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const starters = [tr("starter1"), tr("starter2"), tr("starter3")];
  const router = useRouter();
  const go = () => {
    const t = text.trim();
    try {
      if (t) sessionStorage.setItem("beacon:first", t);
    } catch {
      /* storage blocked: the check still opens */
    }
    router.push("/check", { transitionTypes: ["nav-forward"] });
  };
  return (
    <div className="home-start">
      <form
        className="composer hero-input"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label htmlFor="home-input" className="sr-only">
          {tr("inputLabel")}
        </label>
        <textarea
          ref={box}
          id="home-input"
          rows={2}
          placeholder={tr("inputHint")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go();
            }
          }}
        />
        <div className="row">
          <span className="hint">{tr("alsoSpeak")}</span>
          <span className="spacer" />
          <button type="submit" className="send" aria-label={tr("go")}>
            <Icon name="arrow" size={20} />
          </button>
        </div>
      </form>
      {/* Starters fill the box rather than sending, so the person can make it theirs first. */}
      <ul className="hero-starters" aria-label={tr("startersLabel")}>
        {starters.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => {
                setText(s);
                box.current?.focus();
              }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      <Link
        href="/check#example=margaret"
        className="quiet-link"
        transitionTypes={["nav-forward"]}
      >
        {tr("watch")} <Icon name="arrow" size={16} />
      </Link>
    </div>
  );
}
