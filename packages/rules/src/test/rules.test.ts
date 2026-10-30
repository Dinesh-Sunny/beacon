import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bornForWinterFuel, isOver75, needsBirthMonth, reachedStatePensionAge } from '../age.ts';
import { htmlToText, pageFromContent } from '../govuk.ts';
import { settleFinding } from '../finding.ts';
import { precheck } from '../precheck.ts';
import { nextStep, planSteps } from '../questions.ts';
import { lineLink, verifyQuote } from '../quote.ts';
import type { Situation } from '../situation.ts';

const TODAY = new Date(Date.UTC(2026, 9, 30)); // 30 Oct 2026

// The sample person: Brent, over State Pension age, lives alone, council tenant, State Pension only
const sample: Situation = {
  forSomeoneElse: false,
  postcodeDistrict: 'HA9',
  nation: 'england',
  council: 'Brent',
  birthYear: 1952,
  household: 'alone',
  benefits: [],
  home: 'council-or-housing-association',
  pensionIncome: 'under-line',
  savings: 'under-10000',
  applies: ['health-condition'],
};

describe('State Pension age from birth year and month', () => {
  it('born before 1960 has reached it', () => assert.equal(reachedStatePensionAge({ year: 1955 }, TODAY), 'yes'));
  it('born 1970 has not', () => assert.equal(reachedStatePensionAge({ year: 1970 }, TODAY), 'no'));
  it('1960 needs the month', () => {
    assert.equal(needsBirthMonth(1960), true);
    assert.equal(reachedStatePensionAge({ year: 1960 }, TODAY), 'unsure');
  });
  it('born Jan 1960 reached 66 in Jan 2026', () => assert.equal(reachedStatePensionAge({ year: 1960, month: 1 }, TODAY), 'yes'));
  it('born May 1960 (66 and 2 months) reaches it in July 2026', () =>
    assert.equal(reachedStatePensionAge({ year: 1960, month: 5 }, TODAY), 'yes'));
  it('born Feb 1961 (66 and 11 months) has not yet', () => assert.equal(reachedStatePensionAge({ year: 1961, month: 2 }, TODAY), 'no'));
  it('75 line and Winter Fuel cut-off', () => {
    assert.equal(isOver75({ year: 1950 }, TODAY), 'yes');
    assert.equal(isOver75({ year: 1951 }, TODAY), 'unsure');
    assert.equal(bornForWinterFuel({ year: 1960, month: 5 }), 'yes');
    assert.equal(bornForWinterFuel({ year: 1960, month: 6 }), 'unsure');
    assert.equal(bornForWinterFuel({ year: 1961 }), 'no');
  });
});

describe('the check asks only what can change a result', () => {
  it('sample person skips work, pregnancy and the month', () => {
    const plan = planSteps(sample, TODAY);
    const skipped = plan.filter((p) => !p.shown).map((p) => p.step.id);
    for (const id of ['birth-month', 'spa-fallback', 'partner-birth-year', 'children', 'work', 'pregnancy', 'cared-for'])
      assert.ok(skipped.includes(id as never), `${id} should be skipped`);
    assert.equal(plan.find((p) => p.step.id === 'work')?.skipReason, "Not needed - you've reached State Pension age");
  });
  it('Pension Credit skips money and savings', () => {
    const s: Situation = { ...sample, benefits: ['pension-credit'] };
    const shown = planSteps(s, TODAY).filter((p) => p.shown).map((p) => p.step.id);
    assert.ok(!shown.includes('money') && !shown.includes('savings'));
  });
  it('nextStep walks the shown steps in order', () => {
    assert.equal(nextStep(sample, null, TODAY)?.id, 'area');
    assert.equal(nextStep(sample, 'birth-year', TODAY)?.id, 'household');
  });
  it('birth year withheld asks the yes/no fallback', () => {
    const s: Situation = { ...sample, birthYear: undefined };
    assert.ok(planSteps(s, TODAY).find((p) => p.step.id === 'spa-fallback')?.shown);
  });
});

describe('pre-check settles hard rules in code', () => {
  it('sample person: UC ruled out, Pension Credit open, Housing Benefit open', () => {
    const r = Object.fromEntries(precheck(sample, TODAY).map((p) => [p.scheme, p.status]));
    assert.equal(r['universal-credit'], 'ruled-out');
    assert.equal(r['pension-credit'], 'open');
    assert.equal(r['housing-benefit'], 'open');
    assert.equal(r['healthy-start'], 'ruled-out');
    assert.equal(r['carers-allowance'], 'ruled-out');
    assert.equal(r['attendance-allowance'], 'open');
  });
  it('already getting it is never re-judged', () => {
    const r = precheck({ ...sample, benefits: ['pension-credit'] }, TODAY).find((p) => p.scheme === 'pension-credit');
    assert.equal(r?.status, 'already-get');
  });
});

describe('quote checker', () => {
  const page = pageFromContent(
    '/pension-credit',
    {
      title: 'Pension Credit',
      base_path: '/pension-credit',
      details: { parts: [{ title: 'Eligibility', body: '<p>You must live in England, Scotland or Wales and have reached State Pension age to qualify for Pension Credit.</p>' }] },
    },
    '2026-10-30T00:00:00Z',
  );
  it('accepts the real line despite curly quotes and spacing', () => {
    assert.equal(verifyQuote('You must live in England,  Scotland or Wales and have reached State Pension age', page.text).verified, true);
  });
  it('rejects a made-up line and a too-short one', () => {
    assert.equal(verifyQuote('Everyone over 60 gets Pension Credit automatically', page.text).verified, false);
    assert.equal(verifyQuote('Pension Credit', page.text).verified, false);
  });
  it('downgrades an unverified Likely to Worth checking', () => {
    const f = settleFinding(
      { scheme: 'pension-credit', verdict: 'likely', why: 'x', quote: 'Everyone over 60 gets Pension Credit automatically', becauseYouSaid: [] },
      'pension-credit',
      page,
    );
    assert.equal(f.verdict, 'worth-checking');
    assert.equal(f.quoteVerified, false);
  });
  it('builds a text-fragment link', () => {
    assert.match(lineLink('https://www.gov.uk/pension-credit/eligibility', 'You must live in England, Scotland or Wales and have reached'), /#:~:text=/);
  });
  it('turns HTML into lines', () => assert.equal(htmlToText('<ul><li>One</li><li>Two &amp; three</li></ul>'), '- One\n- Two & three'));
});
