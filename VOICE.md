---
name: "Beacon voice"
description: "Single source of truth for copy: voice, tone, vocabulary, and formatting. Read before writing any user-facing words."
version: 1
# Settings below are the machine-readable part. Prose sections explain and show them.
audience:
  primary: "UK adults checking what support may be theirs, often older, stretched or new to benefits, sometimes helping someone else"
  default_awareness: "problem-aware"      # unaware | problem-aware | solution-aware | product-aware | most-aware
  sophistication: 3                       # 1-5 (Schwartz); 3 = lead with the mechanism
voice:
  traits: ["plain", "warm", "specific"]
  person: "second"                        # you/your; first person only in stories and quotes
  tense: "present"                        # past tense for stories
  reading_level_max: 6                    # Flesch-Kincaid grade
  contractions: true
  sentence_length: "varied"               # mix long and short; no all-staccato runs
  exclamation_marks: 0
  emoji: false
  dashes: "none"                          # no em/en dashes; use commas, colons, parentheses, periods
  oxford_comma: true
  heading_case: "sentence"
  button_case: "sentence"
naming:
  product: "Beacon"               # exact casing to enforce; all-lowercase also bans the Capitalised form
  never: ["BEACON", "Beacon AI", "the Beacon app"]
vocabulary:
  prefer:
    - { use: "get", not: "learn" }
    - { use: "use", not: "utilize" }
  banned: ["eligible", "eligibility", "entitled", "claimant", "AI", "seamless", "robust", "cutting-edge", "game-changing", "revolutionary", "supercharge", "unlock", "leverage", "empower", "delve", "elevate", "best-in-class", "world-class", "next-level", "effortless", "blazing fast", "stunning"]
claims:
  must_be_verifiable: true                # every claim maps to something shipped or measured
  numbers: "exact"                        # 4,000 not "thousands"; source each one
  superlatives: "only with proof"
  testimonials: "real, attributed, unedited meaning"
cta:
  form: "verb first, says what happens next"
  max_words: 5
---

# Voice

Who reads this: anyone, human or agent, writing user-facing words for Beacon. That includes the site, UI microcopy, emails, docs intros, ads, and release notes. The `direct-response-copywriting` and `humanizer` skills read this file first and treat it as binding. When a skill's generic advice conflicts with this file, this file wins.

Edit the frontmatter to change a setting. Keep the prose and examples in step with it.

`pnpm copy:check` (part of `pnpm check`) and an edit hook enforce the mechanical rules on UI copy: banned words, product-name form, dashes, exclamation marks, emoji. Mark a deliberate exception on one line with `voice-allow: <reason>`. Tone, claims, and CTA form are judged by the copywriting skills, not the checker.

## Voice traits

| Trait | Means | Doesn't mean |
|---|---|---|
| Plain | Short common words. One idea per sentence. | Dumbed down or jokey. |
| Specific | Numbers, names, commands, file paths. Point at the thing. | Jargon to sound technical. |
| Dry confidence | State what it does and stop. Let facts carry the weight. | Hype, exclamation marks, superlatives. |

## Tone by context

Voice stays fixed; tone shifts with the reader's situation. Replace the examples with your product's own.

| Context | Tone | Example |
|---|---|---|
| Landing | Warm, plain, a promise we can keep | "Find the support that's already yours." |
| UI labels & buttons | Terse, verb first | "Start my check" · "Read the rules for me" |
| Empty states | Helpful, names the next step | "No results yet. Answer a few simple questions and we'll read the official rules for you." |
| Errors | Calm; problem, then fix, answers safe | "We couldn't connect just now. Your answers are safe in this browser." |
| Emails | Letter, not newsletter; one person to one person | Opens with what's happening now, ends with one ask. |
| Docs intros | Neutral, says who it's for in line one | "For admins setting up single sign-on." |

## Vocabulary

- Use the reader's words over ours. Pull them from issues, reviews, support threads, and calls (see the copywriting skill's research sources).
- Prefer pairs and banned words live in the frontmatter. Add new ones there.
- Write the product name exactly as `naming.product` gives it, everywhere.

## Formatting

- Sentence case for headings and buttons. No title case.
- No em or en dashes, no emoji, no exclamation marks.
- Commands, paths, and code in `code` style.
- Paragraphs of two lines or fewer on screen. Bold only for a term the reader must find again.

## Claims and proof

- Every claim must be true today and traceable to the repo, a measurement, or a named source.
- Use exact numbers and say where they come from in a code comment or source note next to the copy.
- A smaller claim we can prove beats a bigger one we can't.
- No invented testimonials, stories, scarcity, or credentials.

## Examples

| Don't | Do |
|---|---|
| "A robust, seamless platform for modern teams." | A specific, checkable fact about what it does. |
| "Unlock the full potential of your data!" | The concrete result, with a number if you have one. |
| "Learn how to set up your account." | "Connect your first repo in two minutes." |
| "Submit" | A verb that names the outcome: "Send invite". |

## Beacon rules

- Results are guidance, never a decision: "looks likely", "worth checking", "unlikely right now", "you get this". Never "you qualify" or "you are eligible".
- Every result shows the official rule line it rests on. Don't state a rule in copy that the code or GOV.UK page doesn't back.
- Money is shown as bands and rule edges, never asked as exact amounts. Say "a rough guess is fine".
- Privacy lines must stay literally true: nothing stored on the server, answers live in this browser tab.
- Jargon gets a plain name first: "Department for Work and Pensions (DWP)", "State Pension age".
- Name what only the person can do (call, sign, give exact figures). Beacon never claims to apply for them.

## Brand-specific inputs (fill when the product is defined)

These need real answers from the team, not guesses. Until then, the defaults above apply.

- Customer quotes and the words they use for the problem: <!-- TODO -->
- Voice sample (a page or email the team considers on-brand): <!-- TODO -->
- Competitors and the lines they own (so we don't echo them): <!-- TODO: entitledto, Turn2us, Policy in Practice -->
- Legal or compliance limits on claims: guidance only, not financial or legal advice; point to GOV.UK or a free adviser.
