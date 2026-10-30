// Facts worked out from the answers, so later questions can be skipped (the "ask first" levers).

import { bornForWinterFuel, isOver75, reachedStatePensionAge, type Tri } from './age.ts';
import { has, livesWithPartner, type Situation } from './situation.ts';

export interface Facts {
  overStatePensionAge: Tri;
  partnerOverStatePensionAge: Tri | 'n/a';
  over75: Tri;
  winterFuelAge: Tri;
  /** Pension Credit Guarantee Credit or UC: income and savings cannot change any verdict */
  meansTestedPassport: boolean;
  workingAge: boolean;
}

const fromYear = (year: number | undefined, month: number | undefined, today: Date, f: typeof reachedStatePensionAge): Tri =>
  year === undefined ? 'unsure' : f(month ? { year, month } : { year }, today);

export function deriveFacts(s: Situation, today: Date = new Date()): Facts {
  const own = s.statePensionAge ?? fromYear(s.birthYear, s.birthMonth, today, reachedStatePensionAge);
  const partner = livesWithPartner(s)
    ? (s.partnerStatePensionAge ?? fromYear(s.partnerBirthYear, undefined, today, reachedStatePensionAge))
    : 'n/a';
  return {
    overStatePensionAge: own,
    partnerOverStatePensionAge: partner,
    over75: s.birthYear ? isOver75({ year: s.birthYear, month: s.birthMonth }, today) : 'unsure',
    winterFuelAge: s.birthYear ? bornForWinterFuel({ year: s.birthYear, month: s.birthMonth }) : 'unsure',
    meansTestedPassport: has(s, 'pension-credit') || has(s, 'universal-credit'),
    workingAge: own === 'no',
  };
}
