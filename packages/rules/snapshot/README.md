---
license: apache-2.0
pretty_name: Beacon UK rules snapshot
language:
  - en
task_categories:
  - question-answering
  - text-retrieval
tags:
  - benefits
  - public-services
  - uk
  - gov-uk
  - long-context
  - beam
size_categories:
  - n<1K
configs:
  - config_name: pages
    data_files:
      - pension-credit.json
      - council-tax-reduction.json
      - warm-home-discount.json
      - attendance-allowance.json
      - housing-benefit.json
      - carers-allowance.json
      - universal-credit.json
      - healthy-start.json
      - winter-fuel-payment.json
      - free-tv-licence.json
---

# Beacon UK rules snapshot

The exact text of the official GOV.UK pages that Beacon gives to Beam when it judges whether someone may get a kind of support. It is for anyone who wants to reproduce a Beacon result or an eval run, or to test long-context reading of real public-service rules.

## What's in it

- One JSON file per scheme (`pension-credit.json`, `universal-credit.json` and so on). Each holds the pages that scheme reads, with every guide part joined under its heading: `path`, `url`, `title`, `text`, `publicUpdatedAt` (when GOV.UK last changed it) and `readAt` (when Beacon read it).
- `manifest.json`: when the snapshot was taken, the rules config date, each scheme's file and pages, and any scheme that could not be read on that run.

## How it is made

`pnpm snapshot` in the Beacon repo reads each page through the free [GOV.UK Content API](https://content-api.publishing.service.gov.uk) and turns the HTML into plain text (list items and paragraphs kept as lines). It runs when the Space is built. If GOV.UK can't be reached, the older files are kept and the build carries on.

Beacon's quote checker compares the line Beam quotes against this text, so a result can always be checked against what the model actually read.

## Licence and source

The page text is Crown copyright, published by GOV.UK under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), which allows reuse with attribution: "Contains public sector information licensed under the Open Government Licence v3.0." The snapshot tooling and file layout are Apache 2.0.

## Limits

- A snapshot is a moment in time. Rules and amounts change, usually each April. Check `publicUpdatedAt` and `readAt` before relying on it.
- GOV.UK pages are summaries. The law and the detailed guidance behind them can have exceptions the pages don't mention.
- Council Tax Reduction is run by each council; the GOV.UK page only points there.
- Healthy Start's own rules live on the NHS site, which is not in this snapshot.
