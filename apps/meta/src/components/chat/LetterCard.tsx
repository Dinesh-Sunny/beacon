"use client";

// What Beacon read from a letter: the photo with the letter outlined by SAM 3.1, then the
// sender, a plain summary, what it asks and any deadline.

import { Icon } from "@/components/Icon";
import type { LetterView } from "./ChatPanel";

export function LetterCard({ l }: { l: LetterView }) {
  const b = l.box;
  const sx = b?.w ? 100 / b.w : 100 / l.w;
  const sy = b?.h ? 100 / b.h : 100 / l.h;
  return (
    <div className="letter-card" data-testid="letter-card">
      <div className="letter-photo">
        <img src={l.image} alt="" />
        {b && (
          <span
            className="letter-box"
            style={{ left: `${b.x1 * sx}%`, top: `${b.y1 * sy}%`, width: `${(b.x2 - b.x1) * sx}%`, height: `${(b.y2 - b.y1) * sy}%` }}
          >
            <em>Letter found</em>
          </span>
        )}
      </div>
      <div className="letter-body">
        <span className="eyebrow">{l.from ?? "Letter"}</span>
        <b>{l.kind ?? "What it says"}</b>
        {l.summary && <p>{l.summary}</p>}
        {l.action && (
          <p className="letter-action">
            <Icon name="arrow" size={16} /> {l.action}
          </p>
        )}
        {l.deadlines.map((d) => (
          <p key={d.what} className="letter-deadline">
            <Icon name="clock" size={16} /> {d.what}
            {d.date ? ` by ${new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}
