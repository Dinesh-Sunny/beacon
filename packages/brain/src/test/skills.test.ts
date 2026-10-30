import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CARERS_ALLOWANCE,
  EARNINGS_EDGES,
  HEALTHY_START_PREGNANCY_WEEKS,
  longDate,
  PENSION_CREDIT,
  SAVINGS_EDGES,
  WARM_HOME_DISCOUNT,
  WINTER_FUEL,
} from "@beacon/rules";

// The skills are prose for the model, so they repeat a few figures. When config.ts is uprated,
// these fail until the skills are updated too.
const skill = (id: string): string =>
  readFileSync(new URL(`../skills/${id}/SKILL.md`, import.meta.url), "utf8");
const n = (x: number): string => x.toLocaleString("en-GB");

describe("skills match config.ts", () => {
  const cases: Array<[string, string[]]> = [
    [
      "pension-credit",
      [
        String(PENSION_CREDIT.singleWeekly),
        String(PENSION_CREDIT.coupleWeekly),
      ],
    ],
    ["housing-benefit", [n(SAVINGS_EDGES.upperCap)]],
    [
      "universal-credit",
      [n(SAVINGS_EDGES.upperCap), n(SAVINGS_EDGES.ucReductionsFrom)],
    ],
    [
      "healthy-start",
      [
        String(EARNINGS_EDGES.healthyStartMonthly),
        `${HEALTHY_START_PREGNANCY_WEEKS} weeks`,
      ],
    ],
    [
      "carers-allowance",
      [
        String(EARNINGS_EDGES.carersAllowanceWeekly),
        String(CARERS_ALLOWANCE.hoursPerWeek),
      ],
    ],
    ["winter-fuel-payment", [longDate(WINTER_FUEL.bornOnOrBefore)]],
    ["warm-home-discount", [longDate(WARM_HOME_DISCOUNT.qualifyingDate)]],
  ];
  for (const [id, figures] of cases)
    it(`should state the current figures when reading ${id}`, () => {
      const text = skill(id);
      for (const f of figures)
        assert.ok(text.includes(f), `${id}/SKILL.md should mention ${f}`);
    });
});
