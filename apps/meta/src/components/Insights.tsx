"use client";

// Vercel Web Analytics and Speed Insights: cookieless page counts and real-user speed. Answers
// can live in a shared link's #fragment, so every URL is cut back to its path before it's sent;
// no answers, fragments or query strings ever leave the page.

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const pathOnly = <T extends { url: string }>(event: T): T => {
  const u = new URL(event.url);
  return { ...event, url: `${u.origin}${u.pathname}` };
};

export function Insights() {
  return (
    <>
      <Analytics beforeSend={pathOnly} />
      <SpeedInsights beforeSend={pathOnly} />
    </>
  );
}
