"use client";

// Share this check with family or an adviser. Uses the phone's own share sheet when there is
// one (Web Share API), otherwise copies the link. The answers travel in the link itself.

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useCheck } from "@/lib/check-store";
import { shareLink } from "@/lib/share";

export function ShareCheck() {
  const { answers, subject } = useCheck();
  const [note, setNote] = useState("");
  const share = async () => {
    const url = await shareLink(answers, subject);
    const title =
      subject.who === "me"
        ? "My Beacon check"
        : `Beacon check for ${subject.label}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({
          title,
          text: "What looks likely, and the plan to claim it.",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote(
        "Link copied. Anyone with it can see these answers, so send it only to people you trust.",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setNote(
          "Couldn't share from this browser. Save or print works instead.",
        );
    }
  };
  return (
    <>
      <button
        type="button"
        className="btn ghost small"
        onClick={() => void share()}
        data-testid="share"
      >
        <Icon name="share" size={16} /> Share
      </button>
      {note && (
        <p className="hint" role="status">
          {note}
        </p>
      )}
    </>
  );
}
