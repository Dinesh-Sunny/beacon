// Every money line, date and age edge Beacon uses, in one place. Uprate each April from the linked pages.
// Checked on GOV.UK, NHS Healthy Start and Brent Council on 30 Oct 2026 (tax year 2026-27).

export const RULES_AS_OF = "2026-10-30";

export const PENSION_CREDIT = {
  // Guarantee Credit standard minimum guarantee, per week
  singleWeekly: 238,
  coupleWeekly: 363.25,
  source: "https://www.gov.uk/pension-credit/eligibility",
} as const;

// Sources: gov.uk/universal-credit/eligibility, gov.uk/pension-credit/eligibility,
// gov.uk/housing-benefit/eligibility, brent.gov.uk/ctsupport. Limits are inclusive ("or less").
export const SAVINGS_EDGES = {
  ucReductionsFrom: 6_000,
  brentWorkingAgeCtrCap: 6_000,
  pensionCreditTariffFrom: 10_000,
  upperCap: 16_000, // UC, Housing Benefit, pension-age Council Tax Reduction
} as const;

// Sources: healthystart.nhs.uk/how-to-apply (monthly take-home), gov.uk/carers-allowance/eligibility
// (the carer's own earnings, weekly), brent.gov.uk/ctsupport (working-age bands, weekly).
export const EARNINGS_EDGES = {
  healthyStartMonthly: 408,
  carersAllowanceWeekly: 204,
  brentCtrWorkingAgeWeekly: 250,
} as const;

export const CARERS_ALLOWANCE = {
  hoursPerWeek: 35,
  source: "https://www.gov.uk/carers-allowance/eligibility",
} as const;

export const WINTER_FUEL = {
  // Winter 2026-27: born on or before this date
  bornOnOrBefore: "1960-06-27",
  clawbackIncomeOver: 35_000,
  source: "https://www.gov.uk/winter-fuel-payment/eligibility",
} as const;

export const WARM_HOME_DISCOUNT = {
  qualifyingDate: "2026-08-23",
  source:
    "https://www.gov.uk/the-warm-home-discount-scheme/if-you-live-in-england-and-wales",
} as const;

export const TV_LICENCE_FREE_AGE = 75;

/** Healthy Start: "more than 10 weeks pregnant" (healthystart.nhs.uk/how-to-apply). */
export const HEALTHY_START_PREGNANCY_WEEKS = 10;

// State Pension age (Pensions Act 2014 s.26, legislation.gov.uk/ukpga/2014/19): 66 for births before
// 6 Apr 1960, then 66 plus one month per monthly step to 5 Mar 1961, then 67.
export const STATE_PENSION_AGE = {
  sixtySixBefore: 19_600_406,
  sixtySevenFrom: 19_610_306,
  stepYears: [1960, 1961],
  source: "https://www.legislation.gov.uk/ukpga/2014/19/section/26",
} as const;

/** "27 June 1960" from an ISO date, for copy. */
export const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** "£16,000" */
export const pounds = (n: number): string => `£${n.toLocaleString("en-GB")}`;

/** Weekly to monthly, the way DWP converts (x 52 / 12). */
export const weeklyToMonthly = (weekly: number): number =>
  Math.round((weekly * 52) / 12);
