# Marketing patterns from steep.app, and how Beacon uses them

For anyone editing Beacon's marketing pages (src/app/page.tsx, src/app/how/page.tsx, src/components/marketing/). One line per pattern: what it is - why it works - how Beacon uses it.

Studied 4 Nov 2026: steep.app home, /ai and /product (text extraction; the headless browser was blocked by the proxy, so visual notes come from structure, alt text and asset names).

## Sections and components

- Announcement pill above the hero - one line of news before the headline, so the page feels alive - Beacon uses a plain (non-link) pill with real facts: free, 21 kinds of help, three nations.
- Split hero with a live product frame - headline and one action on the left, the product doing its job on the right - Beacon keeps HomeStart as the action and plays an example check that types, asks and lights up results.
- Mock chat input with a sample question - shows the product's real input instead of describing it - Beacon's hero frame shows an adult child typing about their mum.
- Logo strip marquee ("Trusted by teams at") - social proof in a looping row - Beacon has no customers to show and invents none; the marquee shows the 21 real schemes it checks, pulled from the rules pack.
- Three-up value grid (icon, title, one line) - fast to skim, sets up the deeper sections - Beacon turns it into the eight-step rail, the four live steps solid, the four next steps dashed.
- Eyebrow tag above each H2 ("Product", "Steep AI") - tells skimmers where they are - Beacon uses small mono tags ("The Beacon Framework", "How it works today").
- Product section rhythm: headline, subhead, big visual, then a bento of feature cards - each section proves one idea - Beacon's "It starts with a chat" bento has a mini CSS mockup in every card.
- Bento cards with an image and a bold title plus one line - richer than plain cards - Beacon cards draw their own mini UI (result rows, warning, call note, letter outline) in CSS.
- Text-only tile row (Pivot tables, Cohort analysis) - lists capabilities without a picture each - Beacon uses the model chips (Muse Spark, Muse Voice Transcribe, SAM 3.1, Muse Image).
- Feature list with bold label and one line, often 2x2 - for rules and safeguards - Beacon's "Rules Beacon keeps" becomes a numbered ledger.
- Product overview diagram - one wide picture that explains the whole system - Beacon's signature animated framework: people on the left, providers on the right, the lamp in the middle lighting beams between them.
- Customer story card - Beacon skips it (no real quotes yet).
- Final CTA ("Get started for free") with a short reassurance line - Beacon's closing panel: one button, plus the privacy facts.
- Multi-column footer - Beacon keeps its existing SiteFooter.

## Creatives and graphics

- Decorative flat colour shapes behind product shots - add warmth without photos - Beacon uses soft amber radial glows from its lamp instead of shapes.
- Real UI screenshots as the main imagery - honest and specific - Beacon draws its own UI in CSS and SVG (no external images).
- Avatars with name and role in chat mockups - make the use case human - Beacon names the reader's situation ("my mum is 78") instead of a persona.

## Motion and micro-interactions

- Looping marquee - quiet movement that signals breadth - Beacon's scheme marquee, paused under reduced motion.
- Animated product demo (cursor, typed prompt) - shows the flow without a video - Beacon's chat demo reveals messages and results on a timer once in view.
- Scroll reveals on sections - keep long pages calm - Beacon's Reveal wrapper fades and lifts sections once, and is off under reduced motion.
- Number emphasis - Beacon counts up £24.1bn and the How page stats once in view.

## Layout and type

- Wide 1160px container, generous section padding (about 100px desktop, 56px mobile) - Beacon uses the same rhythm.
- Sentence-case H2s, short and declarative, one-sentence subheads - Beacon uses Fraunces for H1/H2 at about 4.4rem/3rem, Atkinson for body at 18px.
- One primary action per section - Beacon's only buttons are the hero input and "Start a check".
