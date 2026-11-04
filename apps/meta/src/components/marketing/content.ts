// The eight steps every person goes through. Their words live in messages under home.loop.<id>.

export const LOOP = [
  { id: "understand", live: true },
  { id: "match", live: true },
  { id: "warn", live: true },
  { id: "act", live: true },
  { id: "confirm", live: true },
  { id: "receive", live: true },
  { id: "keep", live: true },
  { id: "watch", live: true },
] as const;

export const SOURCE_URL =
  "https://policyinpractice.co.uk/publication/missing-out-2025";

/** The US figure: the IRS's own estimate of people who could get the EITC but don't claim it. */
export const SOURCE_URL_US =
  "https://www.taxpayeradvocate.irs.gov/news/nta-blog/eitc-awareness-day-is-january-23/2026/01";
