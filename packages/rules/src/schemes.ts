// The support Beacon reads for England (the verified pack). Each scheme names the official pages the
// agent reads; the GOV.UK Content API serves them at https://www.gov.uk/api/content/<path>.

export type SchemeId =
  | 'pension-credit'
  | 'council-tax-reduction'
  | 'warm-home-discount'
  | 'attendance-allowance'
  | 'housing-benefit'
  | 'carers-allowance'
  | 'universal-credit'
  | 'healthy-start'
  | 'winter-fuel-payment'
  | 'free-tv-licence';

export interface Scheme {
  id: SchemeId;
  name: string;
  /** Who runs it, in the words people use */
  runBy: string;
  /** GOV.UK paths read in full (guide parts are included) */
  govukPaths: string[];
  /** Plain line shown on cards */
  summary: string;
  nations: Array<'england' | 'scotland' | 'wales' | 'northern-ireland'>;
  /** How to claim, from the official page */
  claim: { route: 'phone' | 'online' | 'council' | 'automatic'; detail: string; url: string };
  /** Other schemes this one opens the door to */
  unlocks?: SchemeId[];
}

export const SCHEMES: Scheme[] = [
  {
    id: 'pension-credit',
    name: 'Pension Credit',
    runBy: 'DWP',
    govukPaths: ['/pension-credit'],
    summary: 'Tops up weekly income for people over State Pension age, and opens the door to more help.',
    nations: ['england', 'scotland', 'wales'],
    claim: { route: 'phone', detail: 'Pension Credit claim line: 0800 99 1234 (Relay UK 18001 then 0800 99 1234), Monday to Friday, 8am to 6pm', url: 'https://www.gov.uk/pension-credit/how-to-claim' },
    unlocks: ['council-tax-reduction', 'housing-benefit', 'warm-home-discount', 'free-tv-licence', 'winter-fuel-payment'],
  },
  {
    id: 'council-tax-reduction',
    name: 'Council Tax Reduction',
    runBy: 'your council',
    govukPaths: ['/council-tax-reduction'],
    summary: 'Lowers your council tax bill if your income is low.',
    nations: ['england', 'scotland', 'wales'],
    claim: { route: 'council', detail: 'Apply to your council', url: 'https://www.gov.uk/apply-council-tax-reduction' },
  },
  {
    id: 'warm-home-discount',
    name: 'Warm Home Discount',
    runBy: 'your electricity supplier',
    govukPaths: ['/the-warm-home-discount-scheme'],
    summary: 'A one-off discount on your electricity bill in winter.',
    nations: ['england', 'wales', 'scotland'],
    claim: { route: 'automatic', detail: 'Usually paid automatically if you qualify', url: 'https://www.gov.uk/the-warm-home-discount-scheme' },
  },
  {
    id: 'attendance-allowance',
    name: 'Attendance Allowance',
    runBy: 'DWP',
    govukPaths: ['/attendance-allowance'],
    summary: 'Extra money if you need help with personal care because of an illness or disability. Not means-tested.',
    nations: ['england', 'wales', 'northern-ireland'],
    claim: { route: 'phone', detail: 'Attendance Allowance helpline: 0800 731 0122 (Relay UK 18001 then 0800 731 0122), Monday to Friday, 8am to 6pm', url: 'https://www.gov.uk/attendance-allowance/how-to-claim' },
    unlocks: ['pension-credit'],
  },
  {
    id: 'housing-benefit',
    name: 'Housing Benefit',
    runBy: 'your council',
    govukPaths: ['/housing-benefit'],
    summary: 'Help paying rent for people over State Pension age, or in supported housing.',
    nations: ['england', 'scotland', 'wales'],
    claim: { route: 'council', detail: 'Apply to your council, or with your Pension Credit claim', url: 'https://www.gov.uk/housing-benefit/how-to-claim' },
  },
  {
    id: 'carers-allowance',
    name: "Carer's Allowance",
    runBy: 'DWP',
    govukPaths: ['/carers-allowance'],
    summary: 'Money for people who look after someone for 35 hours a week or more.',
    nations: ['england', 'wales', 'northern-ireland'],
    claim: { route: 'online', detail: "Apply online on GOV.UK", url: 'https://www.gov.uk/carers-allowance/how-to-claim' },
  },
  {
    id: 'universal-credit',
    name: 'Universal Credit',
    runBy: 'DWP',
    govukPaths: ['/universal-credit'],
    summary: 'Monthly payment for living costs for people under State Pension age on a low income or out of work.',
    nations: ['england', 'scotland', 'wales'],
    claim: { route: 'online', detail: 'Apply online on GOV.UK', url: 'https://www.gov.uk/universal-credit/how-to-claim' },
    unlocks: ['warm-home-discount', 'healthy-start', 'council-tax-reduction'],
  },
  {
    id: 'healthy-start',
    name: 'Healthy Start',
    runBy: 'the NHS',
    govukPaths: ['/healthy-start'],
    summary: 'A prepaid card for milk, fruit, vegetables and vitamins in pregnancy and for children under 4.',
    nations: ['england', 'wales', 'northern-ireland'],
    claim: { route: 'online', detail: 'Apply on the NHS Healthy Start website', url: 'https://www.healthystart.nhs.uk/how-to-apply/' },
  },
  {
    id: 'winter-fuel-payment',
    name: 'Winter Fuel Payment',
    runBy: 'DWP',
    govukPaths: ['/winter-fuel-payment'],
    summary: 'A yearly payment towards heating for people born on or before the cut-off date.',
    nations: ['england', 'wales', 'northern-ireland'],
    claim: { route: 'automatic', detail: 'Paid automatically to most people who qualify', url: 'https://www.gov.uk/winter-fuel-payment/how-to-claim' },
  },
  {
    id: 'free-tv-licence',
    name: 'Free TV licence',
    runBy: 'TV Licensing',
    govukPaths: ['/free-discount-tv-licence'],
    summary: 'A free TV licence if you are 75 or over and you or your partner get Pension Credit.',
    nations: ['england', 'scotland', 'wales', 'northern-ireland'],
    claim: { route: 'online', detail: 'Apply to TV Licensing', url: 'https://www.gov.uk/free-discount-tv-licence' },
  },
];

export const schemeById = (id: SchemeId): Scheme => {
  const s = SCHEMES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scheme ${id}`);
  return s;
};
