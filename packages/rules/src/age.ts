// Age lines from birth year (and month only for 1960-61), never the full date of birth.
// State Pension age timetable: https://www.gov.uk/state-pension-age (Pensions Acts 2011 and 2014).

import { TV_LICENCE_FREE_AGE, WINTER_FUEL } from './config.ts';

export type Tri = 'yes' | 'no' | 'unsure';

export interface BirthInput {
  year: number;
  /** 1-12; only asked when the year is 1960 or 1961 */
  month?: number;
}

/** Years + months of State Pension age for one exact birth date. */
function spaFor(y: number, m: number, d: number): { years: number; months: number } {
  const born = y * 10_000 + m * 100 + d;
  if (born < 19600406) return { years: 66, months: 0 };
  if (born >= 19610306) return { years: 67, months: 0 };
  // 6 Apr 1960 to 5 Mar 1961: 66 plus one month for each step that starts on the 6th
  const stepsFromApril = (y - 1960) * 12 + (m - 4) + (d >= 6 ? 1 : 0);
  return { years: 66, months: stepsFromApril };
}

const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

function addYearsMonths(y: number, m: number, d: number, years: number, months: number): Date {
  const total = (y + years) * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  return new Date(Date.UTC(ty, tm - 1, Math.min(d, lastDay(ty, tm))));
}

/** True / false when every possible birth day agrees, 'unsure' when the answer depends on the day. */
function forAllDays(input: BirthInput, test: (y: number, m: number, d: number) => boolean): Tri {
  const months = input.month ? [input.month] : Array.from({ length: 12 }, (_, i) => i + 1);
  let seenTrue = false;
  let seenFalse = false;
  for (const m of months) {
    for (let d = 1; d <= lastDay(input.year, m); d++) {
      if (test(input.year, m, d)) seenTrue = true;
      else seenFalse = true;
      if (seenTrue && seenFalse) return 'unsure';
    }
  }
  return seenTrue ? 'yes' : 'no';
}

/** Does the year (or year + month) need the month asked to settle State Pension age? */
export const needsBirthMonth = (year: number): boolean => year === 1960 || year === 1961;

export function reachedStatePensionAge(input: BirthInput, today: Date = new Date()): Tri {
  return forAllDays(input, (y, m, d) => {
    const { years, months } = spaFor(y, m, d);
    return addYearsMonths(y, m, d, years, months) <= today;
  });
}

export function ageAtLeast(input: BirthInput, age: number, today: Date = new Date()): Tri {
  return forAllDays(input, (y, m, d) => addYearsMonths(y, m, d, age, 0) <= today);
}

export const isOver75 = (input: BirthInput, today?: Date): Tri => ageAtLeast(input, TV_LICENCE_FREE_AGE, today);

/** Winter Fuel Payment: born on or before the cut-off for this winter. */
export function bornForWinterFuel(input: BirthInput): Tri {
  const [cy, cm, cd] = WINTER_FUEL.bornOnOrBefore.split('-').map(Number) as [number, number, number];
  const cutoff = cy * 10_000 + cm * 100 + cd;
  return forAllDays(input, (y, m, d) => y * 10_000 + m * 100 + d <= cutoff);
}

/** Plausible birth year for an adult using Beacon (18 to 110). */
export function birthYearError(year: number, today: Date = new Date()): string | null {
  const now = today.getUTCFullYear();
  if (!Number.isInteger(year)) return 'Enter the year as 4 numbers, for example 1957';
  if (year > now - 18) return 'Beacon is for people aged 18 or over';
  if (year < now - 110) return 'Check the year - enter it as 4 numbers, for example 1957';
  return null;
}
