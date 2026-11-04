# Coverage catalogue

This guide is for anyone adding schemes or data sources to Beacon. `coverage.json` is the single map of everything Beacon covers now and plans to cover next. It follows the Beacon Framework: the people who need help on one side, the providers who give it on the other, and Beacon in the middle.

It has three parts:

- **people** - each group Beacon serves, the answer facts that already describe them (`facts`, ids from `src/engine/answers-schema.ts`) and the facts Beacon would still need (`missingFacts`, in plain words).
- **providers** - each group of organisations that give help. For each one: a rough `scale` with its source (or `null` when no source was found), the scheme ids already `live` in the rule packs, the `next` schemes to add, and the `connectors` (data sources) that can feed them.
- **strategy** - the next 10 groups to add, in order, with the reason and the connector to use.

## Updating it

- Change it by a normal reviewed edit. Bump `version` to the date of the edit.
- Only set `checked` to a date when you read the official page that day. Otherwise leave it `null`.
- Never put a number in `scale`, `rule` or `schemesEstimate` without a source. If there isn't one, use `null` or describe it in words.
- When a `next` scheme goes live, move its id into `live` and delete it from `next`.
- Validate after every edit:

```sh
node -e "JSON.parse(require('fs').readFileSync('apps/meta/catalog/coverage.json','utf8'))"
```

## From a "next" item to a live scheme

1. Read the official page in `url` again and note every rule line, amount and date.
2. Pick the pack it belongs in (`apps/meta/packs/uk-core.json`, `uk-bills.json`, `uk-health.json`, `uk-council.json`), or start a new pack file for a new group of help.
3. Add the scheme to the pack's `schemes` list. The `id` from the catalogue is already in the right shape (lowercase letters only). Fill `name`, `topic`, `by`, `gives`, `how`, `url` and a `rule` list. Each rule names the facts it `needs` and a `test` written in the small expression language.
4. Put every number, date or age line in the pack's `lines`, each with its `source` link.
5. The pack is validated with zod in `src/engine/pack.ts` (`PackSchema`, then `RegistrySchema` checks ids, lines, topics and cross-pack references). Run lint, type-check and tests.
6. If the rule needs a fact Beacon does not ask yet, add it to `src/engine/answers-schema.ts` and `DERIVED_KEYS` first. That is a bigger change: Beacon never asks for name, full address, NI number, bank details, exact amounts or a full date of birth, so keep new facts to yes, no, unsure or bands.

The `facts` on `next` items use today's fact ids where they fit. These ids are proposals and are not in the answers schema yet: benefitMonths, childCount, childDisabled, complaint, conditionList, crimeVictim, debt, employerInsolvent, energyDebt, epc, failedFirm, hasBank, homeAdapt, hourlyPay, hrt, inEducation, jobCosts, legalIssue, livesAlone, married, oldAccounts, pensionPot, redundant, rxItems, schoolDistance, sickOff, veteran, waterMeter, workInjury, yearsService.

## Connectors

| Connector | Kind | Access | Gives Beacon |
| --- | --- | --- | --- |
| [GOV.UK Content API](https://content-api.publishing.service.gov.uk/) | api | open | JSON for any GOV.UK page. No key, 10 requests a second, OGL v3.0 |
| [GOV.UK Search API](https://www.gov.uk/api/search.json) | search | open | Lists GOV.UK pages by type, browse page and organisation |
| [GOV.UK local-authority API](https://www.gov.uk/api/local-authority?postcode=HA90WS) | api | open | Postcode to council name, website and tier (undocumented, cache it) |
| [GOV.UK Local Links Manager export](https://local-links-manager.publishing.service.gov.uk/data/links_to_services_provided_by_local_authorities.csv) | dataset | open | Every council's page per service: 7,165 kept links, 33 services, 380 councils |
| [postcodes.io](https://postcodes.io/) | api | open | Postcode to council code, ward, nation, deprivation index |
| [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/) | dataset | open | Official list of every council name and code |
| mygov.scot, gov.wales, nidirect | page | scrape | Devolved schemes; no content API found |
| [Ofcom social tariffs](https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs) | page | scrape | 34 broadband and mobile social tariffs from 28 providers |
| [CCW water companies](https://www.ccw.org.uk/advice-and-support/households/water-companies/) | page | scrape | 20 water companies; WaterSure and social tariff guidance |
| nhs.uk and NHSBSA | page | scrape | Help with health costs in England |
| [360Giving GrantNav](https://grantnav.threesixtygiving.org/) | dataset | open | 1.56m grants, 355 funders, 255,271 grants to individuals. CC BY 4.0 |
| [360Giving API and Datastore](https://www.360giving.org/explore/technical/api/) | api | open | Same data by API, refreshed nightly |
| [Charity Commission register API](https://api-portal.charitycommission.gov.uk/) | api | key | England and Wales charity details; free sign-up for a key |
| [Charity Commission full register download](https://register-of-charities.charitycommission.gov.uk/en/register/full-register-download) | dataset | open | Daily JSON and tab-delimited extract |
| [OSCR register download](https://www.oscr.org.uk/about-charities/search-the-register/charity-register-download/) | dataset | open | Daily Scottish register, OGL v2.0, accept terms first |
| [CCNI register](https://www.charitycommissionni.org.uk/charity-search/) | search | scrape | Northern Ireland charities; no download found |
| [Find that Charity](https://findthatcharity.uk/about) | api | open | All UK regulators in one place, JSON per charity |
| [Turn2us Grants Search](https://www.turn2us.org.uk/get-support/grants-search) | search | licence | Over 1,700 grant-giving organisations; personal use only |
| [MoneyHelper](https://www.moneyhelper.org.uk/) | page | scrape | Debt advice locator, Pension Wise |
| [Pension Tracing Service](https://www.gov.uk/find-pension-contact-details) | search | open | Pension provider contacts (link out only) |
| [HMRC find a Child Trust Fund](https://www.gov.uk/child-trust-funds/find-a-child-trust-fund) | search | open | Where a CTF was opened (needs NI number, so link out only) |
| [My Lost Account](https://www.mylostaccount.org.uk/) | search | open | Lost bank, building society and NS&I accounts (link out only) |
| [Reclaim Fund](https://www.reclaimfund.co.uk/) | page | open | How the dormant assets scheme works; holds no customer records |
| [Unclaimed estates list](https://www.gov.uk/government/statistical-data-sets/unclaimed-estates-list) | dataset | open | Estates waiting for relatives; format and licence to confirm |
| [NS&I prize checker](https://www.nsandi.com/prize-checker) | search | open | Premium Bonds prizes (link out only) |
| entitledto, Policy in Practice, Turn2us calculator | page | licence | Comparators to check Beacon's results by hand, never sources |

## Order to reach thousands of schemes

The first steps add tens of schemes with facts Beacon mostly already asks. The big numbers come from multiplying a provider list by a scheme type.

1. **Council Tax discounts and disregards** - a few national rules, linked to the right page in every council.
2. **Schools** - free school meals in all four nations, transport and bursaries.
3. **Devolved benefits** - Scotland first (Scottish Child Payment, Best Start, Scottish Welfare Fund), then Wales and Northern Ireland.
4. **More UK-wide schemes** - Marriage Allowance, job expenses, Carer's Credit, Help to Save, Budgeting Loans.
5. **Unclaimed money** - link-out checks that need no sensitive answers.
6. **Utilities** - one entry per water company and per broadband social tariff.
7. **NHS costs** - travel costs, prepayment and exemption certificates.
8. **Councils x local schemes** - take the full council list from the ONS portal, find each council with postcodes.io or the GOV.UK local-authority API, then read each council's crisis help, DHP and local grant pages. This is the first route to thousands of entries.
9. **Charities x grant datasets** - use 360Giving to find funders that pay individuals, the Charity Commission and OSCR downloads to get their purposes and areas, then read each funder's own page for the rules.
10. **Employment rights** - statutory pay, redundancy and insolvency claims.

## What needs a licence or permission

- **Turn2us Grants Search** - its terms allow personal, non-commercial use only and forbid building a database from it. Ask Turn2us for a data licence before any automated use. Until then, only link people to it.
- **Charity Commission API** - needs a free subscription key from the developer portal.
- **OSCR download** - accept the terms first, credit OSCR under OGL v2.0, no direct marketing, and do not present it as the official register.
- **360Giving data** - CC BY 4.0, so credit 360Giving and each funder.
- **entitledto, Policy in Practice and Turn2us calculators** - commercial or personal-use tools. Use them only as comparators by hand.
- **mygov.scot, gov.wales, nidirect, nhs.uk, CCW, Ofcom, MoneyHelper and council sites** - no API. Read their terms, respect robots.txt, fetch slowly and cache, as the GOV.UK reader does.
- **HMRC CTF tool, My Lost Account, NS&I and the Pension Tracing Service** - they need personal details Beacon must never collect, so Beacon links out and never automates them.

## Not yet verified

Items with `checked: null` were not confirmed on the official page on 2026-11-04, often because the site refused automated fetches (nidirect, gov.wales, parts of nhs.uk, CCW and the FCA). Recheck them before they go into a pack.
