---
license: apache-2.0
pretty_name: BenefitsBench
language:
  - en
task_categories:
  - text-classification
  - question-answering
tags:
  - benefits
  - public-services
  - uk
  - eligibility
  - agents
  - beam
  - synthetic
size_categories:
  - n<1K
configs:
  - config_name: cases
    data_files: benefitsbench.json
---

# BenefitsBench

A small, honest test set for UK benefit finders. It is for people building or judging tools that tell someone which support may be theirs, and it is the test set behind Beacon (an agent on Reflection AI's Beam 1.0).

## What's in it

- **30 made-up situations.** No real people. Each is a set of answers in the bands Beacon asks (birth year, household, home, benefits already received, income band, savings band, caring and health), plus a short story in plain English.
- **An expected verdict for each of 10 schemes**, 300 in all: Pension Credit, Council Tax Reduction, Warm Home Discount, Attendance Allowance, Housing Benefit, Carer's Allowance, Universal Credit, Healthy Start, Winter Fuel Payment and the free TV licence for over-75s.
- Verdicts are `likely`, `worth-checking`, `unlikely-right-now` or `already-get`. Some expectations list `alsoAccept` verdicts a careful adviser would also give from the same answers (for example when a deciding question has not been asked yet).
- `settledBy` says whether a hard rule settles it before any reading (`precheck`) or whether the rule page has to be read and judged (`model`).
- `knownRulesGap` marks the places where Beacon's code does not yet match the official rules. There is one at release.

Coverage: over and under State Pension age, the 1960-61 birth-month band, mixed-age couples both ways, the Pension Credit passport, Universal Credit, full-time and part-time carers (including the earnings limit and the cared-for person's benefit), Healthy Start with and without Universal Credit, Scotland, Wales and Northern Ireland, savings at £6,000, £10,000 and £16,000, the Winter Fuel cut-off (27 June 1960), a care home, and people who would rather not say their income, savings or birth year.

## How the expectations were written

From the official rules, not from any model's output: GOV.UK eligibility pages, NHS Healthy Start and Brent Council's Council Tax Support scheme, checked on 30 October 2026 (tax year 2026-27). Every case is judged as of `asOf` (30 October 2026), because age lines move with time.

## Results files

Each Beacon run adds a JSONL file: one line per case and effort level, with the final verdict per scheme, whether it was right, input and output tokens per step, and how many quoted rule lines were found word for word on the page. `summary.md` holds accuracy per scheme, tokens per effort and the quote-verified rate. Only measured runs are published.

## Limits

- 30 cases is small. It catches clear mistakes; it can't give a tight error bar.
- Answers are bands, so cases near a line expect `worth-checking`. That is the honest answer, but it makes the set easier than real advice work.
- Council Tax Reduction differs by council. Working-age expectations follow Brent's scheme.
- Money lines are 2026-27 figures. They change every April; re-check before reusing.
- Expectations were written by one person from the rules and reviewed against Beacon's pre-check; they have not been reviewed by a welfare rights adviser. Corrections are welcome in the Discussions tab.
- This is not legal or financial advice.

## Licence

Apache 2.0.
