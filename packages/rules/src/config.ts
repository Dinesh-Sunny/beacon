// Every money line, date and age edge Beacon uses, in one place. Uprate each April from the linked pages.
// Checked on GOV.UK, NHS Healthy Start and Brent Council on 30 Oct 2026 (tax year 2026-27).

export const RULES_AS_OF = '2026-10-30';

export const PENSION_CREDIT = {
  // Guarantee Credit standard minimum guarantee, per week
  singleWeekly: 238,
  coupleWeekly: 363.25,
  savingsTariffFrom: 10_000,
  source: 'https://www.gov.uk/pension-credit/eligibility',
} as const;

export const SAVINGS_EDGES = {
  ucReductionsFrom: 6_000,
  brentWorkingAgeCtrCap: 6_000,
  pensionCreditTariffFrom: 10_000,
  upperCap: 16_000, // UC, Housing Benefit, pension-age Council Tax Reduction
} as const;

export const EARNINGS_EDGES = {
  healthyStartMonthly: 408,
  carersAllowanceWeekly: 204,
  brentCtrWorkingAgeWeekly: 250,
} as const;

export const CARERS_ALLOWANCE = { hoursPerWeek: 35, source: 'https://www.gov.uk/carers-allowance/eligibility' } as const;

export const WINTER_FUEL = {
  // Winter 2026-27: born on or before this date
  bornOnOrBefore: '1960-06-27',
  clawbackIncomeOver: 35_000,
  source: 'https://www.gov.uk/winter-fuel-payment/eligibility',
} as const;

export const WARM_HOME_DISCOUNT = {
  qualifyingDate: '2026-08-23',
  source: 'https://www.gov.uk/the-warm-home-discount-scheme/if-you-live-in-england-and-wales',
} as const;

export const TV_LICENCE_FREE_AGE = 75;

/** Weekly to monthly, the way DWP converts (x 52 / 12). */
export const weeklyToMonthly = (weekly: number): number => Math.round((weekly * 52) / 12);
