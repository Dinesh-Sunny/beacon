import type { Verdict } from "@beacon/rules";
import { VERDICT_LABEL } from "@beacon/rules";

// Beacon marks (base.js BEACONS): full light = Likely, half = Worth checking, ring = Unlikely.
export function BeaconMark({
  verdict,
  size = 20,
}: {
  verdict: Verdict;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {verdict === "likely" && (
        <>
          <path
            d="M12 1.5v2.5M3.5 4.5l1.8 1.8M20.5 4.5l-1.8 1.8M1.5 12H4M20 12h2.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="12"
            cy="13"
            r="6.5"
            fill="#F5A524"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {verdict === "worth-checking" && (
        <>
          <path d="M12 6.5a6.5 6.5 0 0 0 0 13z" fill="#F5A524" />
          <circle
            cx="12"
            cy="13"
            r="6.5"
            fill="none"
            stroke="var(--verdict-maybe)"
            strokeWidth="2"
          />
        </>
      )}
      {verdict === "unlikely-right-now" && (
        <circle
          cx="12"
          cy="13"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {verdict === "already-get" && (
        <path
          d="M20 6 9 17l-5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`verdict ${verdict}`}>
      <BeaconMark verdict={verdict} />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function findingTitle(
  name: string,
  verdict: Verdict,
  forSomeoneElse = false,
): string {
  const who = forSomeoneElse ? "them" : "you";
  switch (verdict) {
    case "likely":
      return `${name} looks likely for ${who}`;
    case "worth-checking":
      return `${name} is worth checking`;
    case "unlikely-right-now":
      return `${name} looks unlikely right now`;
    case "already-get":
      return forSomeoneElse
        ? `They already get ${name}`
        : `You already get ${name}`;
  }
}

/** The bar that fills one segment per kind of support as each is read (D-040 to D-050). */
export function VerdictBar({
  verdicts,
  label,
}: {
  verdicts: (Verdict | "pending")[];
  label: string;
}) {
  return (
    <div className="vbar" role="img" aria-label={label}>
      {verdicts.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
        <span key={i} className={v} style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}
