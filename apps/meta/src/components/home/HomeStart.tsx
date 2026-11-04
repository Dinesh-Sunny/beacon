"use client";

// The home page's main input: whatever you type here opens the check with the agent already
// reading it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export function HomeStart() {
  const [text, setText] = useState("");
  const router = useRouter();
  const go = () => {
    const t = text.trim();
    try {
      if (t) sessionStorage.setItem("beacon:first", t);
    } catch {
      /* storage blocked: the check still opens */
    }
    router.push("/check");
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
          Tell Beacon about your situation
        </label>
        <textarea
          id="home-input"
          rows={2}
          placeholder="For example: my mum is 78, lives alone in Wembley and finds stairs hard"
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
          <span className="hint">Type, speak or add a letter on the next page</span>
          <span className="spacer" />
          <button type="submit" className="send" aria-label="Start">
            <Icon name="arrow" size={20} />
          </button>
        </div>
      </form>
      <div className="chips">
        <Link href="/check">Answer a few questions</Link>
        <Link href="/check#example=margaret">Watch Margaret's check</Link>
        <Link href="/how">How Beacon works</Link>
      </div>
    </div>
  );
}
