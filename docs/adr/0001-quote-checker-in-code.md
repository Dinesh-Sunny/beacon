# 0001 - The quote checker runs in code, not in the model

- Status: accepted
- Date: 2026-10-30

For anyone changing how Beacon decides a verdict.

## Context

Beacon's whole promise is "here is the exact rule line this rests on". A model can misquote, paraphrase, or quote a line from a different scheme or an older version of a page, and a person deciding whether to call DWP can't tell. Asking the model to check its own quote doesn't remove the risk; it moves it.

## Decision

- Beam proposes every finding through a forced tool call (`record_finding`) that must include the exact quoted sentence.
- Code (`verifyQuote` in `packages/rules/src/quote.ts`) checks the quote appears word for word in the page text Beam was given, after folding differences that aren't wording: case, whitespace, curly quotes, dashes, non-breaking spaces. Quotes under six words don't count.
- `settleFinding` sets the final verdict. A Likely without a verified quote becomes Worth checking. The model never gets the last word.
- The checked offset gives a "See this line on the page" link (a text-fragment URL).

## Consequences

- A Likely is always backed by a real line someone can read on GOV.UK.
- Some correct Likely answers will be shown as Worth checking when the quote is slightly off. We accept that: a softer answer costs less than a wrong confident one.
- The quote-verified rate becomes something we can measure per effort level (BenefitsBench reports it).
- Pages must be read whole (long context), so the quote is checked against exactly what the model saw.
