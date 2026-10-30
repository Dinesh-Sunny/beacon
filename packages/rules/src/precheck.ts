// Hard rules settled in code before the model reads anything: what is already received, what the
// answers rule out, and what is open for Beam to judge from the official page. Code never says Likely
// on its own: a Likely always needs a verified quote from the page.

import { deriveFacts } from './facts.ts';
import { SCHEMES, type SchemeId } from './schemes.ts';
import { has, hasChildren, livesWithPartner, type Situation } from './situation.ts';

export type PrecheckStatus = 'already-get' | 'ruled-out' | 'open';

export interface Precheck {
  scheme: SchemeId;
  status: PrecheckStatus;
  /** Plain reason shown to the person (and given to the model as context) */
  reason: string;
  /** Answer that would settle it, when one more question could */
  oneMoreQuestion?: 'cared-for' | 'care-needed-6-months' | 'landlord-close-relative' | 'council-tax-in-name' | 'electricity-in-name';
}

const benefitFor: Partial<Record<SchemeId, Parameters<typeof has>[1]>> = {
  'pension-credit': 'pension-credit',
  'universal-credit': 'universal-credit',
  'housing-benefit': 'housing-benefit',
  'council-tax-reduction': 'council-tax-reduction',
  'attendance-allowance': 'attendance-allowance',
  'carers-allowance': 'carers-allowance',
};

export function precheck(s: Situation, today: Date = new Date()): Precheck[] {
  const f = deriveFacts(s, today);
  const nation = s.nation ?? 'england';
  return SCHEMES.map((scheme): Precheck => {
    const id = scheme.id;
    const got = benefitFor[id];
    if (got && has(s, got)) return { scheme: id, status: 'already-get', reason: `You told us you already get ${scheme.name}.` };
    if (!scheme.nations.includes(nation)) return { scheme: id, status: 'ruled-out', reason: `${scheme.name} works differently where you live. We point you to the local version.` };

    switch (id) {
      case 'pension-credit':
        if (f.overStatePensionAge === 'no') return { scheme: id, status: 'ruled-out', reason: 'Pension Credit starts at State Pension age.' };
        if (livesWithPartner(s) && f.partnerOverStatePensionAge === 'no')
          return { scheme: id, status: 'ruled-out', reason: 'When one partner is under State Pension age, Universal Credit applies instead.' };
        break;
      case 'universal-credit':
        if (f.overStatePensionAge === 'yes' && !(livesWithPartner(s) && f.partnerOverStatePensionAge === 'no'))
          return { scheme: id, status: 'ruled-out', reason: 'Universal Credit is for people under State Pension age.' };
        if (s.savings === '16000-plus') return { scheme: id, status: 'ruled-out', reason: 'Universal Credit has a £16,000 savings limit.' };
        break;
      case 'housing-benefit':
        if (s.home && !['council-or-housing-association', 'private-rent'].includes(s.home))
          return { scheme: id, status: 'ruled-out', reason: 'Housing Benefit is help with rent.' };
        if (has(s, 'universal-credit')) return { scheme: id, status: 'ruled-out', reason: 'Universal Credit includes help with rent.' };
        if (f.overStatePensionAge === 'no') return { scheme: id, status: 'ruled-out', reason: 'For people under State Pension age, help with rent comes through Universal Credit.' };
        if (livesWithPartner(s) && f.partnerOverStatePensionAge === 'no')
          return { scheme: id, status: 'ruled-out', reason: 'When one partner is under State Pension age, help with rent comes through Universal Credit.' };
        if (s.savings === '16000-plus' && !has(s, 'pension-credit')) return { scheme: id, status: 'ruled-out', reason: 'Housing Benefit has a £16,000 savings limit.' };
        return { scheme: id, status: 'open', reason: 'Depends on your rent and income.', oneMoreQuestion: 'landlord-close-relative' };
      case 'attendance-allowance':
        if (f.overStatePensionAge === 'no') return { scheme: id, status: 'ruled-out', reason: 'Attendance Allowance is for people over State Pension age. PIP covers younger people.' };
        if (has(s, 'pip-or-dla')) return { scheme: id, status: 'ruled-out', reason: 'You already get PIP or DLA, which covers the same needs.' };
        if (!s.applies?.includes('health-condition') && !s.anythingElse)
          return { scheme: id, status: 'ruled-out', reason: 'You did not mention needing help with daily care.' };
        return { scheme: id, status: 'open', reason: 'Depends on the help you need and how long you have needed it.', oneMoreQuestion: 'care-needed-6-months' };
      case 'carers-allowance':
        if (!s.applies?.includes('cares-35-hours')) return { scheme: id, status: 'ruled-out', reason: "Carer's Allowance is for 35 hours of caring a week or more." };
        if (s.earnings === '885-1083' || s.earnings === 'over-1083')
          return { scheme: id, status: 'ruled-out', reason: "Carer's Allowance has an earnings limit of £204 a week after tax and expenses." };
        if (s.caredForGetsDisabilityBenefit === 'no')
          return { scheme: id, status: 'ruled-out', reason: "The person you look after needs to get Attendance Allowance, PIP daily living or DLA care." };
        return { scheme: id, status: 'open', reason: 'Depends on the person you care for and your earnings.', oneMoreQuestion: 'cared-for' };
      case 'healthy-start':
        if (!(hasChildren(s) && s.childUnder4) && !s.expecting) return { scheme: id, status: 'ruled-out', reason: 'Healthy Start is for pregnancy and children under 4.' };
        break;
      case 'winter-fuel-payment':
        if (f.winterFuelAge === 'no') return { scheme: id, status: 'ruled-out', reason: 'Winter Fuel Payment is for people born on or before 27 June 1960.' };
        break;
      case 'free-tv-licence':
        if (f.over75 === 'no') return { scheme: id, status: 'ruled-out', reason: 'The free TV licence starts at 75.' };
        break;
      case 'council-tax-reduction':
        if (s.home === 'care-home') return { scheme: id, status: 'ruled-out', reason: 'Council tax is not usually paid in a care home.' };
        return { scheme: id, status: 'open', reason: 'Depends on your council, income and savings.', oneMoreQuestion: s.billsInName?.rentOrCouncilTax ? undefined : 'council-tax-in-name' };
      case 'warm-home-discount':
        if (!has(s, 'pension-credit') && !has(s, 'universal-credit') && !has(s, 'housing-benefit') && !has(s, 'esa') && s.pensionIncome === 'well-over-line')
          return { scheme: id, status: 'ruled-out', reason: 'Warm Home Discount follows means-tested help like Pension Credit.' };
        return { scheme: id, status: 'open', reason: 'Follows Pension Credit and other means-tested help.', oneMoreQuestion: s.billsInName?.electricity ? undefined : 'electricity-in-name' };
    }
    return { scheme: id, status: 'open', reason: 'Beacon reads the official rules for this.' };
  });
}
