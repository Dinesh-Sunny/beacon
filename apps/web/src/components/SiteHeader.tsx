"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SITE } from "@/lib/site";
import { Icon } from "./Icon";

/** Replace this page in history so Back does not return to Beacon. */
const leave = () => window.location.replace(SITE.leaveUrl);

export function SiteHeader() {
  // Pressing Shift 3 times quickly leaves the page (safety exit, same as the button).
  useEffect(() => {
    let presses: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Shift" || e.repeat) return;
      const now = Date.now();
      presses = [
        ...presses.filter((t) => now - t < SITE.leaveShiftWindowMs),
        now,
      ];
      if (presses.length >= SITE.leaveShiftCount) leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="hdr">
      <Link className="logo" href="/">
        <span className="mark" aria-hidden="true" />
        Beacon
      </Link>
      <div className="hright">
        <Link className="btn txt small max-sm:hidden" href="/about">
          About Beacon
        </Link>
        <a
          className="leave"
          href={SITE.leaveUrl}
          onClick={(e) => {
            e.preventDefault();
            leave();
          }}
          aria-describedby="leave-hint"
        >
          Leave this page <Icon name="leave" size={16} />
        </a>
        <span id="leave-hint" className="sr-only">
          Or press Shift 3 times
        </span>
      </div>
    </header>
  );
}
