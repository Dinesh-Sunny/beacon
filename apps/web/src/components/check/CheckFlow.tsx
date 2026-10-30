"use client";

import {
  birthYearError,
  deriveFacts,
  type NATIONS,
  needsBirthMonth,
  nextStep,
  planSteps,
  type Situation,
  STEPS,
  type StepId,
} from "@beacon/rules";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Draft,
  emptyDraft,
  encodeFragment,
  MONTH_NAMES,
  optionsFor,
  parseDraft,
  ROW_LABEL,
  readFragment,
  valueLabel,
} from "@/lib/answers";
import { gaps, PATH, pathKeyOf, pathRows } from "@/lib/check-path";
import { useCheck } from "@/lib/check-store";
import { SITE } from "@/lib/site";
import { Icon } from "../Icon";
import { BeaconPath } from "./BeaconPath";
import { Rail } from "./Rail";

type Nation = (typeof NATIONS)[number];
type Problem = { text: string; href: string };

const COUNTRY_TO_NATION: Record<string, Nation> = {
  England: "england",
  Scotland: "scotland",
  Wales: "wales",
  "Northern Ireland": "northern-ireland",
};
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;
/** Steps where "I'd rather not say" is offered (money, health and family questions). */
const CAN_DECLINE: StepId[] = [
  "birth-year",
  "children",
  "money",
  "savings",
  "pregnancy",
  "applies",
];
const PRIVATE_NOTE =
  "This is private. We use it only for this check, hide it on screen, and keep nothing unless you choose to save.";
const ELSE_MAX = 500;

const step = (id: StepId) =>
  STEPS.find((s) => s.id === id) ?? (STEPS[0] as (typeof STEPS)[number]);

// ---------- reading and writing one step's answer ----------
function radioValue(id: StepId, s: Situation): string | undefined {
  const spaOver = deriveFacts(s).overStatePensionAge !== "no";
  switch (id) {
    case "household":
      return s.household;
    case "home":
      return s.home;
    case "work":
      return s.work;
    case "money":
      return (spaOver ? s.pensionIncome : s.earnings) ?? undefined;
    case "savings":
      return s.savings;
    case "pregnancy":
      return s.expecting === undefined ? undefined : s.expecting ? "yes" : "no";
    case "spa-fallback":
      return s.statePensionAge;
    case "cared-for":
      return s.caredForGetsDisabilityBenefit;
    default:
      return undefined;
  }
}

function setRadio(id: StepId, s: Situation, v: string | undefined): Situation {
  const spaOver = deriveFacts(s).overStatePensionAge !== "no";
  const n = { ...s } as Record<string, unknown>;
  const put = (k: string) => {
    n[k] = v;
  };
  if (id === "household") put("household");
  else if (id === "home") put("home");
  else if (id === "work") put("work");
  else if (id === "money") put(spaOver ? "pensionIncome" : "earnings");
  else if (id === "savings") put("savings");
  else if (id === "pregnancy")
    n.expecting = v === undefined ? undefined : v === "yes";
  else if (id === "spa-fallback") put("statePensionAge");
  else if (id === "cared-for") put("caredForGetsDisabilityBenefit");
  return n as Situation;
}

function checkedValues(id: StepId, s: Situation): string[] {
  if (id === "benefits") return s.benefits ?? [];
  if (id === "applies") return s.applies ?? [];
  if (id === "children")
    return [
      s.childUnder4 ? "child-under-4" : "",
      s.expecting ? "expecting" : "",
    ].filter(Boolean);
  return [];
}

function setChecked(id: StepId, s: Situation, values: string[]): Situation {
  const real = values.filter((v) => v !== "none");
  if (id === "benefits")
    return { ...s, benefits: real as Situation["benefits"] };
  if (id === "applies") return { ...s, applies: real as Situation["applies"] };
  if (id === "children")
    return {
      ...s,
      childUnder4: real.includes("child-under-4"),
      expecting: real.includes("expecting"),
    };
  return s;
}

/** Drop answers to steps that the latest answers made unnecessary, so they cannot sway a result. */
function prune(d: Draft): Draft {
  const plan = planSteps(d.situation);
  const skipped = new Set(plan.filter((p) => !p.shown).map((p) => p.step.id));
  const s = { ...d.situation };
  const progress = { ...d.progress };
  const drop = (id: StepId, keys: (keyof Situation)[]) => {
    if (!skipped.has(id)) return;
    for (const k of keys) delete s[k];
    delete progress[id];
  };
  drop("birth-month", ["birthMonth"]);
  drop("partner-birth-year", ["partnerBirthYear", "partnerStatePensionAge"]);
  drop("work", ["work"]);
  drop("money", ["pensionIncome", "earnings"]);
  drop("savings", ["savings"]);
  drop("cared-for", ["caredForGetsDisabilityBenefit"]);
  if (skipped.has("children")) {
    delete s.childUnder4;
    delete progress.children;
  }
  if (skipped.has("pregnancy")) delete progress.pregnancy;
  if (skipped.has("children") && skipped.has("pregnancy")) delete s.expecting;
  return { ...d, situation: s, progress };
}

function startingStep(d: Draft): StepId {
  if (Object.keys(d.progress).length === 0) return "area";
  return gaps(d.situation, d.progress)[0] ?? "review";
}

// ---------- small parts ----------
function WhyWeAsk({ text }: { text: string }) {
  return (
    <details className="why small">
      <summary>
        <svg
          className="chev"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        Why we ask
      </summary>
      <p className="muted mt-1 pl-7">{text}</p>
    </details>
  );
}

function Choice({
  type,
  name,
  id,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="opt" htmlFor={id}>
      <input
        id={id}
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
      />
      <span className={type === "radio" ? "ring" : "box"} aria-hidden="true">
        {type === "checkbox" && <Icon name="check" size={16} />}
      </span>
      {label}
    </label>
  );
}

// ---------- the flow ----------
export function CheckFlow() {
  const { draft, setDraft, setResults } = useCheck();
  const router = useRouter();
  const [current, setCurrent] = useState<StepId>(() => startingStep(draft));
  const [fromReview, setFromReview] = useState(false);
  const [before, setBefore] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<StepId | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemN, setProblemN] = useState(0);
  const [u18, setU18] = useState(false);
  const [yearText, setYearText] = useState("");
  const [noneTicked, setNoneTicked] = useState<
    Partial<Record<StepId, boolean>>
  >({});
  // Postcode step
  const [pc, setPc] = useState(draft.situation.postcodeDistrict ?? "");
  const [councils, setCouncils] = useState<string[]>([]);
  const [areaNote, setAreaNote] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pcNotSure, setPcNotSure] = useState(
    draft.progress.area === "done" && !draft.situation.postcodeDistrict,
  );

  const h1 = useRef<HTMLHeadingElement>(null);
  const errBox = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  const s = draft.situation;
  const facts = deriveFacts(s);
  const rows = pathRows(s, draft.progress);
  const q = step(current);
  const title =
    current === "review"
      ? "Is this all right?"
      : u18
        ? "Beacon is for adults for now"
        : q.question(s, facts);

  // Load answers from the link fragment once (refresh, or a saved private link).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const fromHash = parseDraft(readFragment(window.location.hash, "a"));
    if (fromHash) {
      setDraft(fromHash);
      setCurrent(startingStep(fromHash));
      setPc(fromHash.situation.postcodeDistrict ?? "");
    }
  }, [setDraft]);

  // Mirror answers into the fragment; it never reaches the server.
  useEffect(() => {
    if (!loaded.current) return;
    window.history.replaceState(null, "", `#${encodeFragment("a", draft)}`);
  }, [draft]);

  // New screen: focus the question and name the page after it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run per screen only
  useEffect(() => {
    document.title = `${title} - Beacon`;
    h1.current?.focus();
  }, [current, u18]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: run per error only
  useEffect(() => {
    if (problemN === 0) return;
    document.title = `Error: ${title} - Beacon`;
    errBox.current?.focus();
  }, [problemN]);

  // Seed the year box from saved answers when a year step opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step changes
  useEffect(() => {
    if (current === "birth-year")
      setYearText(s.birthYear ? String(s.birthYear) : "");
    if (current === "partner-birth-year")
      setYearText(s.partnerBirthYear ? String(s.partnerBirthYear) : "");
    setProblem(null);
  }, [current]);

  /** "None of these" is ticked now, or was the saved answer. */
  const noneOn = (id: StepId): boolean =>
    noneTicked[id] ??
    (draft.progress[id] === "done" &&
      checkedValues(id, draft.situation).length === 0);

  const fail = (text: string, href: string) => {
    setProblem({ text, href });
    setProblemN((n) => n + 1);
  };

  const go = (id: StepId, opts: { review?: boolean } = {}) => {
    setProblem(null);
    setU18(false);
    setSaved(null);
    if (opts.review) {
      setFromReview(true);
      setBefore(draft);
    }
    setCurrent(id);
    window.scrollTo({ top: 0 });
  };

  /** Save this step and move on: the next shown step, or back to the review. */
  const advance = (next: Draft) => {
    const pruned = prune(next);
    setDraft(pruned);
    setProblem(null);
    if (fromReview) {
      const gap = gaps(pruned.situation, pruned.progress)[0];
      if (gap) {
        setCurrent(gap);
        return;
      }
      setFromReview(false);
      setBefore(null);
      setSaved(current);
      setCurrent("review");
      return;
    }
    setCurrent(nextStep(pruned.situation, current)?.id ?? "review");
    window.scrollTo({ top: 0 });
  };

  const mark = (d: Draft, status: "done" | "declined"): Draft => ({
    ...d,
    progress: { ...d.progress, [current]: status },
  });

  const back = () => {
    if (fromReview && before) {
      setDraft(before);
      setFromReview(false);
      setBefore(null);
      go(startingStep(before));
      return;
    }
    const plan = planSteps(s).filter((p) => p.shown);
    const i = plan.findIndex((p) => p.step.id === current);
    const prev = plan[i - 1]?.step.id;
    if (prev) go(prev);
    else router.push("/");
  };

  // ---------- postcode lookup (postcodes.io, from the browser) ----------
  const lookUp = async (): Promise<Draft | null> => {
    const d = pc.trim().toUpperCase().split(/\s+/)[0] ?? "";
    if (!OUTCODE.test(d)) {
      fail(
        "Enter the first half of the postcode, like HA9, or choose I'm not sure",
        "#pc",
      );
      return null;
    }
    setLooking(true);
    setCouncils([]);
    setAreaNote(null);
    try {
      const res = await fetch(`${SITE.postcodesApi}${encodeURIComponent(d)}`);
      if (res.status === 404) {
        fail(
          `We could not find ${d}. Check the first half of the postcode, like HA9`,
          "#pc",
        );
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as {
        result?: { admin_district?: string[]; country?: string[] };
      };
      const list = [...new Set(body.result?.admin_district ?? [])];
      const country = body.result?.country?.[0] ?? "";
      const nation = COUNTRY_TO_NATION[country];
      const base: Situation = {
        ...s,
        postcodeDistrict: d,
        nation,
        council: undefined,
      };
      if (list.length === 1) {
        const council = list[0] as string;
        const found: Draft = {
          ...draft,
          situation: { ...base, council },
          areaLabel: `${council}, ${country}`,
        };
        setDraft(found);
        setAreaNote(`We'll use ${council}'s rules, and ${country}'s.`);
        return found;
      }
      const many: Draft = {
        ...draft,
        situation: base,
        areaLabel: list.length === 0 ? `${d} area` : undefined,
      };
      setDraft(many);
      setCouncils(list);
      return list.length === 0 ? many : null;
    } catch {
      // Never block on the look-up: keep the area and carry on.
      const kept: Draft = {
        ...draft,
        situation: { ...s, postcodeDistrict: d },
        areaLabel: `${d} area`,
      };
      setDraft(kept);
      setAreaNote("We couldn't find the council just now. You can carry on.");
      return kept;
    } finally {
      setLooking(false);
    }
  };

  // ---------- Continue ----------
  const onContinue = async () => {
    const kind = q.kind;
    if (current === "area") {
      if (pcNotSure)
        return advance(
          mark(
            {
              ...draft,
              situation: {
                ...s,
                postcodeDistrict: undefined,
                council: undefined,
                nation: undefined,
              },
              areaLabel: undefined,
            },
            "done",
          ),
        );
      if (councils.length > 1 && !s.council)
        return fail("Choose the council", "#council-0");
      if (
        !s.postcodeDistrict ||
        !draft.areaLabel ||
        s.postcodeDistrict !== pc.trim().toUpperCase().split(/\s+/)[0]
      ) {
        const found = await lookUp();
        if (found) advance(mark(found, "done"));
        return;
      }
      return advance(mark(draft, "done"));
    }
    if (kind === "year") {
      const year = Number(yearText.trim());
      if (!/^\d{4}$/.test(yearText.trim()))
        return fail("Enter the year as 4 numbers, like 1957", "#year");
      if (current === "birth-year") {
        if (
          year > new Date().getUTCFullYear() - 18 &&
          year <= new Date().getUTCFullYear()
        ) {
          setU18(true);
          return;
        }
        const err = birthYearError(year);
        if (err) return fail(err, "#year");
        const n: Situation = {
          ...s,
          birthYear: year,
          statePensionAge: undefined,
        };
        if (!needsBirthMonth(year)) delete n.birthMonth;
        const d = mark({ ...draft, situation: n }, "done");
        delete d.progress["spa-fallback"];
        return advance(d);
      }
      const err = birthYearError(year);
      if (err)
        return fail(
          err.replace("Beacon is for people aged 18 or over", "Check the year"),
          "#year",
        );
      return advance(
        mark({ ...draft, situation: { ...s, partnerBirthYear: year } }, "done"),
      );
    }
    if (kind === "month") {
      if (!s.birthMonth)
        return fail("Choose the month you were born", "#month");
      return advance(mark(draft, "done"));
    }
    if (kind === "radio") {
      if (!radioValue(current, s))
        return fail(
          CAN_DECLINE.includes(current)
            ? "Choose one answer, or press I'd rather not say"
            : "Choose one answer",
          "#opt-0",
        );
      return advance(mark(draft, "done"));
    }
    if (kind === "checkbox") {
      if (checkedValues(current, s).length === 0 && !noneOn(current))
        return fail("Choose all that apply, or None of these", "#opt-0");
      return advance(mark(draft, "done"));
    }
    if (kind === "text") return advance(mark(draft, "done"));
  };

  const decline = () => {
    let n: Situation = { ...s };
    if (current === "birth-year")
      n = { ...n, birthYear: undefined, birthMonth: undefined };
    if (current === "money") n = setRadio("money", n, "rather-not-say");
    if (current === "savings") n = { ...n, savings: "rather-not-say" };
    if (current === "pregnancy") n = { ...n, expecting: undefined };
    if (current === "applies") n = { ...n, applies: undefined };
    if (current === "children")
      n = { ...n, childUnder4: undefined, expecting: undefined };
    advance(mark({ ...draft, situation: n }, "declined"));
  };

  const clearAll = () => {
    setDraft(emptyDraft());
    setResults(null);
    setPc("");
    setCouncils([]);
    setAreaNote(null);
    setPcNotSure(false);
    setNoneTicked({});
    setFromReview(false);
    go("area");
  };

  // ---------- the question body ----------
  const invalid = Boolean(problem);
  const describedBy =
    [q.hint ? "hint" : "", invalid ? "err" : ""].filter(Boolean).join(" ") ||
    undefined;

  const options = (() => {
    if (q.kind !== "radio" && q.kind !== "checkbox") return null;
    const opts = optionsFor(current, s).filter(
      (o) => o.value !== "rather-not-say",
    );
    if (q.kind === "radio") {
      const v = radioValue(current, s);
      return opts.map((o, i) => (
        <Choice
          key={o.value}
          type="radio"
          name={current}
          id={`opt-${i}`}
          label={o.label}
          checked={v === o.value}
          onChange={() =>
            setDraft({ ...draft, situation: setRadio(current, s, o.value) })
          }
        />
      ));
    }
    const vals = checkedValues(current, s);
    return opts.map((o, i) => {
      const on = o.exclusive ? noneOn(current) : vals.includes(o.value);
      return (
        <Choice
          key={o.value}
          type="checkbox"
          name={current}
          id={`opt-${i}`}
          label={o.label}
          checked={on}
          onChange={() => {
            if (o.exclusive) {
              setNoneTicked({ ...noneTicked, [current]: !on });
              if (!on)
                setDraft({ ...draft, situation: setChecked(current, s, []) });
              return;
            }
            setNoneTicked({ ...noneTicked, [current]: false });
            setDraft({
              ...draft,
              situation: setChecked(
                current,
                s,
                on ? vals.filter((v) => v !== o.value) : [...vals, o.value],
              ),
            });
          }}
        />
      );
    });
  })();

  let body: ReactNode = null;
  if (q.kind === "postcode") {
    body = (
      <div className="stack gap-3">
        <label htmlFor="pc" className="font-bold">
          First half of the postcode
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="pc"
            className="input w-[200px] uppercase"
            value={pc}
            autoComplete="postal-code"
            spellCheck={false}
            aria-describedby={describedBy}
            aria-invalid={problem?.href === "#pc" ? true : undefined}
            onChange={(e) => {
              setPc(e.target.value);
              setPcNotSure(false);
              setCouncils([]);
              setAreaNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lookUp();
              }
            }}
          />
          <button
            type="button"
            className="btn sec"
            onClick={() => void lookUp()}
            disabled={looking}
          >
            {looking ? "Finding the council" : "Find the council"}
          </button>
        </div>
        {councils.length > 1 && (
          <fieldset className="stack m-0 mt-2 gap-3 border-0 p-0">
            <legend className="mb-2 font-bold">
              {s.postcodeDistrict} covers more than one council. Which is it?
            </legend>
            {councils.map((c, i) => (
              <Choice
                key={c}
                type="radio"
                name="council"
                id={`council-${i}`}
                label={c}
                checked={s.council === c}
                onChange={() =>
                  setDraft({
                    ...draft,
                    situation: { ...s, council: c },
                    areaLabel: c,
                  })
                }
              />
            ))}
          </fieldset>
        )}
        <div role="status" aria-live="polite">
          {draft.areaLabel &&
            !pcNotSure &&
            s.postcodeDistrict === pc.trim().toUpperCase().split(/\s+/)[0] && (
              <div
                className="card !flex-row items-center !gap-3"
                data-testid="area-found"
              >
                <Icon name="pin" size={24} />
                <div className="stack gap-0.5">
                  <p className="t-title">{draft.areaLabel}</p>
                  {areaNote && <p className="small muted">{areaNote}</p>}
                </div>
              </div>
            )}
        </div>
        <Choice
          type="radio"
          name="not-sure"
          id="pc-not-sure"
          label="I'm not sure of the postcode"
          checked={pcNotSure}
          onChange={() => setPcNotSure(true)}
        />
      </div>
    );
  } else if (q.kind === "year") {
    body = (
      <div className="stack gap-2">
        <label htmlFor="year" className="sr-only">
          {current === "birth-year"
            ? "Year of birth"
            : "Partner's year of birth"}
        </label>
        <input
          id="year"
          className="input w-[160px]"
          inputMode="numeric"
          autoComplete={current === "birth-year" ? "bday-year" : "off"}
          spellCheck={false}
          maxLength={4}
          value={yearText}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => setYearText(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && void onContinue()}
        />
      </div>
    );
  } else if (q.kind === "month") {
    body = (
      <div className="stack gap-2">
        <label htmlFor="month" className="font-bold">
          Month
        </label>
        <select
          id="month"
          className="input w-[240px]"
          autoComplete="bday-month"
          value={s.birthMonth ?? ""}
          aria-invalid={invalid || undefined}
          onChange={(e) =>
            setDraft({
              ...draft,
              situation: {
                ...s,
                birthMonth: e.target.value ? Number(e.target.value) : undefined,
              },
            })
          }
        >
          <option value="">Choose a month</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
    );
  } else if (q.kind === "text") {
    const chips = optionsFor("anything-else", s);
    body = (
      <div className="stack gap-4">
        <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">Quick topics</legend>
          {chips.map((c) => {
            const on = draft.elseChips.includes(c.label);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                className={`chip !min-h-11 !px-4 cursor-pointer border-[1.5px] ${on ? "border-[var(--border-strong)] !bg-[var(--verdict-likely-soft)]" : "border-transparent"}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    elseChips: on
                      ? draft.elseChips.filter((x) => x !== c.label)
                      : [...draft.elseChips, c.label],
                  })
                }
              >
                {on && <Icon name="check" size={16} />}
                {c.label}
              </button>
            );
          })}
        </fieldset>
        <label htmlFor="else" className="font-bold">
          In your own words (optional)
        </label>
        <textarea
          id="else"
          className="input min-h-[150px] w-full resize-y !text-[20px]"
          rows={5}
          maxLength={ELSE_MAX}
          value={draft.elseText}
          aria-describedby="else-count"
          placeholder="For example: the stairs are hard on my knees"
          onChange={(e) => setDraft({ ...draft, elseText: e.target.value })}
        />
        <p id="else-count" className="small muted" aria-live="polite">
          {draft.elseText.length} of {ELSE_MAX} letters. No names or numbers,
          please.
        </p>
      </div>
    );
  } else if (options) {
    body = <div className="stack max-w-[600px] gap-3">{options}</div>;
  }

  // ---------- review ----------
  if (current === "review") {
    const planned = planSteps(s).filter(
      (p) => p.shown && p.step.id !== "review",
    );
    const groups = PATH.filter((g) => g.key !== "review")
      .map((g) => ({
        ...g,
        ids: planned
          .map((p) => p.step.id)
          .filter((id) => g.steps.includes(id) && draft.progress[id]),
      }))
      .filter((g) => g.ids.length > 0);
    const declined = Object.values(draft.progress).includes("declined");
    return (
      <div className="wrap">
        <div className="split">
          <div className="stack gap-7 lg:col-start-2">
            <button
              type="button"
              className="btn txt self-start !pl-0"
              onClick={back}
            >
              Back
            </button>
            <div className="stack gap-3">
              <h1 ref={h1} tabIndex={-1} className="d2 outline-none">
                Is this all right?
              </h1>
              <p className="lead">
                Change anything that&apos;s wrong. Then we&apos;ll read the
                rules for you.
              </p>
            </div>
            {declined && (
              <div className="banner">
                <span>
                  You chose not to answer some questions. That&apos;s fine -
                  some results may say Worth checking.
                </span>
              </div>
            )}
            <dl className="kv" data-testid="review">
              {groups.flatMap((g) =>
                g.ids.map((id) => {
                  const value = valueLabel(id, draft);
                  const label = ROW_LABEL[id] ?? g.label;
                  return (
                    <div key={id}>
                      <dt>{label}</dt>
                      <dd>
                        {value}
                        {saved === id && (
                          <span role="status" className="tag ml-2.5">
                            <Icon name="check" size={14} /> Saved
                          </span>
                        )}
                      </dd>
                      <button
                        type="button"
                        className="btn txt"
                        aria-label={`Change ${label.toLowerCase()}, now ${value}`}
                        onClick={() => go(id, { review: true })}
                      >
                        Change
                      </button>
                    </div>
                  );
                }),
              )}
            </dl>
            <p className="small muted">
              Guidance, not a decision. We&apos;ll show the official line behind
              every answer.
            </p>
            <div className="acts">
              <button
                type="button"
                className="btn pri"
                onClick={() => router.push("/check/reading")}
              >
                Read the rules for me <Icon name="arrow-right" />
              </button>
            </div>
          </div>
          <aside
            className="rail stack gap-4 lg:col-start-1 lg:row-start-1"
            aria-label="What happens next"
          >
            <section className="card">
              <h2 className="t-title">What happens next</h2>
              <p className="small">
                We read the official rules for you and show the line behind
                every answer.
              </p>
            </section>
            <p className="small muted flex gap-2 px-3">
              <Icon name="lock" size={18} className="mt-0.5 flex-none" />
              Private. Nothing is saved unless you choose to.
            </p>
          </aside>
        </div>
      </div>
    );
  }

  const pathKey = pathKeyOf(current);

  return (
    <div className="wrap">
      <div className="split">
        <Rail
          rows={rows}
          draft={draft}
          current={pathKey}
          onGo={(id) => go(id, { review: true })}
          onClear={clearAll}
        />
        <div className="stack min-w-0 gap-7">
          <div className="stack gap-3">
            <button
              type="button"
              className="btn txt self-start !pl-0"
              onClick={back}
            >
              {fromReview ? "Cancel - keep my answer" : "Back"}
            </button>
            <BeaconPath rows={rows} current={pathKey} />
          </div>

          {problem && (
            <div
              ref={errBox}
              className="err-summary"
              role="alert"
              tabIndex={-1}
              aria-labelledby="err-title"
            >
              <h2 id="err-title" className="t-title">
                There is a problem
              </h2>
              <a
                href={problem.href}
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector<HTMLElement>(problem.href)?.focus();
                }}
              >
                {problem.text}
              </a>
            </div>
          )}

          {u18 ? (
            <div className="stack gap-4">
              <h1 ref={h1} tabIndex={-1} className="d2 outline-none">
                Beacon is for adults for now
              </h1>
              <p className="lead">
                A trusted adult, your school or college can help. You can also
                talk to Childline, free, on 0800 1111.
              </p>
              <div className="acts">
                <button
                  type="button"
                  className="btn pri"
                  onClick={() => setU18(false)}
                >
                  Change my answer
                </button>
              </div>
            </div>
          ) : (
            <>
              <fieldset
                className={`m-0 flex min-w-0 flex-col gap-4 border-0 p-0 ${problem ? "has-error" : ""}`}
                aria-describedby={describedBy}
              >
                <legend className="float-left mb-4 w-full p-0">
                  <h1 ref={h1} tabIndex={-1} className="d2 outline-none">
                    {title}
                  </h1>
                  {current === "area" && (
                    <p className="lead mt-3">
                      A few short questions. We skip the ones that don&apos;t
                      apply to you.
                    </p>
                  )}
                  {q.hint?.(s, facts) && (
                    <p id="hint" className="lead muted mt-3">
                      {q.hint(s, facts)}
                    </p>
                  )}
                </legend>
                {q.private && (
                  <div className="banner info clear-both">
                    <Icon name="lock" className="mt-0.5 flex-none" />
                    <span>{PRIVATE_NOTE}</span>
                  </div>
                )}
                {problem && (
                  <p id="err" className="err-inline clear-both">
                    <span className="sr-only">Error: </span>
                    {problem.text}
                  </p>
                )}
                <div className="clear-both">{body}</div>
              </fieldset>
              <WhyWeAsk text={q.whyWeAsk} />
              <div className="acts">
                <button
                  type="button"
                  className="btn pri"
                  onClick={() => void onContinue()}
                  disabled={looking}
                >
                  {fromReview ? "Save and go back" : "Continue"}
                </button>
                {CAN_DECLINE.includes(current) && !fromReview && (
                  <button type="button" className="btn txt" onClick={decline}>
                    I&apos;d rather not say
                  </button>
                )}
                {current === "anything-else" && !fromReview && (
                  <button
                    type="button"
                    className="btn txt"
                    onClick={() =>
                      advance(
                        mark({ ...draft, elseChips: [], elseText: "" }, "done"),
                      )
                    }
                  >
                    Skip this
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
