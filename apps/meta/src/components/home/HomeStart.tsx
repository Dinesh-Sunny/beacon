"use client";

// The home page's main input: whatever you type here opens the check with the agent already
// reading it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";

export function HomeStart({ country = "GB" }: { country?: "GB" | "US" }) {
  const tr = useTranslations("site");
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  // Who the check is for only changes the example; the agent reads who from the words.
  const [forWhom, setForWhom] = useState<"me" | "other">("other");
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
      <fieldset className="hs-for">
        <legend className="sr-only">{tr("forLabel")}</legend>
        {(["other", "me"] as const).map((w) => (
          <label key={w} className={forWhom === w ? "on" : undefined}>
            <input
              type="radio"
              name="for"
              value={w}
              checked={forWhom === w}
              onChange={() => {
                setForWhom(w);
                box.current?.focus();
              }}
            />
            {w === "me" ? tr("forMe") : tr("forOther")}
          </label>
        ))}
      </fieldset>
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
          placeholder={tr(
            `${forWhom === "me" ? "inputHintMe" : "inputHint"}${country === "US" ? "Us" : ""}` as "inputHint",
          )}
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
      <Link
        href="/check#example=margaret"
        className="quiet-link"
        transitionTypes={["nav-forward"]}
      >
        <Icon name="play" size={16} /> {tr("tryExample")}
      </Link>
    </div>
  );
}
