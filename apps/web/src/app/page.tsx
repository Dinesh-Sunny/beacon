import { CARERS_ALLOWANCE } from "@beacon/rules";
import { Icon } from "@/components/Icon";
import { StartButtons } from "@/components/StartButtons";
import { BeaconMark, VerdictChip } from "@/components/Verdict";

// Frame: Lands | Feeling: curious, safe. One hero (the headline), one glow (the Likely card).
const PREVIEWS = [
  {
    name: "Council Tax Reduction",
    verdict: "worth-checking" as const,
    title: "Council Tax Reduction is worth checking",
    line: "Your council can cut your bill when your income is low.",
    style: { left: 0, top: 70, transform: "rotate(-6deg)" },
  },
  {
    name: "Carer's Allowance",
    verdict: "unlikely-right-now" as const,
    title: "Carer's Allowance looks unlikely right now",
    line: `It is for ${CARERS_ALLOWANCE.hoursPerWeek} hours of caring a week or more.`,
    style: { right: 0, top: 70, transform: "rotate(6deg)" },
  },
  {
    name: "Pension Credit",
    verdict: "likely" as const,
    title: "Pension Credit looks likely for you",
    // Word for word from gov.uk/pension-credit/eligibility (checked 30 Oct 2026).
    line: '"You must live in England, Scotland or Wales and have reached State Pension age to qualify for Pension Credit."',
    style: { left: "50%", top: 0, transform: "translateX(-50%)" },
  },
];

export default function Landing() {
  return (
    <div className="wrap grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:!pt-24">
      <section className="stack gap-6" aria-labelledby="hero">
        <h1 id="hero" className="d1">
          Find the support that&apos;s already yours.
        </h1>
        <p className="lead max-w-[560px]">
          Answer a few simple questions. Beacon reads the official rules and
          shows what you may be owed.
        </p>
        <StartButtons />
        <p className="small muted flex max-w-[560px] gap-2">
          <Icon name="lock" size={18} className="mt-0.5 flex-none" />
          <span>
            Free. Private - no names, nothing kept after your check unless you
            save it. Every answer shows the rule it comes from.
          </span>
        </p>
        <p className="small muted max-w-[560px]">
          Beacon never asks for your name, bank details or National Insurance
          number, and never asks you to pay.
        </p>
      </section>

      <section
        aria-label="What your results look like"
        className="fan mx-auto w-full max-w-[520px] max-sm:hidden"
      >
        {PREVIEWS.map((p) => (
          <article
            key={p.name}
            className={`card ${p.verdict === "likely" ? "glow z-10" : ""}`}
            style={p.style}
            aria-hidden="true"
          >
            <VerdictChip verdict={p.verdict} />
            <p className="t-title">{p.title}</p>
            <p
              className={`small ${p.verdict === "likely" ? "quote" : "muted"}`}
            >
              {p.line}
            </p>
            {p.verdict === "likely" && (
              <span className="small muted inline-flex items-center gap-1">
                <BeaconMark verdict="likely" size={16} /> Rule line from GOV.UK
              </span>
            )}
          </article>
        ))}
        <p className="sr-only">
          Each result shows if support looks likely, is worth checking, or looks
          unlikely right now, with the rule line it comes from.
        </p>
      </section>
    </div>
  );
}
