# 0002 - Ask the questions that settle the most, and only those

- Status: accepted
- Date: 2026-10-30

For anyone changing the question flow in `packages/rules/src/questions.ts`.

## Context

Long forms are one of the three reasons people miss out (don't know, too hard, ashamed). A first draft asked about 15 questions, several of which no rule needs (rent amount, broadband in your name, hours of caring as a number, children's ages) and some that broke the privacy rules (exact amounts). We checked every question against the official rules for the ten schemes (GOV.UK, NHS Healthy Start, Brent Council, 30 October 2026) and kept only what can change a verdict.

## Decision

1. **Benefits you get now are asked at step 4**, straight after area, age and household. Pension Credit or Universal Credit passports most other answers, so later money and savings questions are skipped for those people, each with a reason on screen ("Not needed - you get Pension Credit").
2. **Birth year, not date of birth.** The year settles State Pension age, the 75 line and the Winter Fuel cut-off for almost everyone. The month is asked only for 1960 and 1961, where State Pension age moves month by month. If the year is withheld, a yes/no/not sure question about State Pension age takes its place. The full date is never asked; when the answer depends on the day, Beacon says Worth checking.
3. **Income and savings bands cut at the rule edges**, so a band never straddles a line that matters:
   - Over State Pension age: income under, around or well over the Pension Credit line for the household (about £1,031 a month single, £1,574 couple); savings under £10,000, £10,000 to £15,999, £16,000 or more.
   - Working age: take-home earnings (not total income) at £408 (Healthy Start), £884 (Carer's Allowance, £204 a week) and £1,083 (Brent working-age Council Tax Reduction, £250 a week); savings under £6,000, £6,000 to £15,999, £16,000 or more.
   - Every money question has "I'd rather not say".
4. **One more question, only when it settles one scheme**: electricity bill in your name (Warm Home Discount), landlord a close relative (Housing Benefit), care needed for 6 months (Attendance Allowance), the cared-for person's benefit (Carer's Allowance).
5. **Dropped**: rent amount, broadband, heating, caring hours as a number, children's ages, age as a number.

## Consequences

- A typical pensioner answers about half the questions of the first draft, and nothing exact.
- Some people land on Worth checking because a band or a missing day can't settle it. That is honest, and the result says which answer would settle it.
- Every band edge lives in `config.ts` with its source, and BenefitsBench has cases on each edge so a change to a line shows up in tests.
