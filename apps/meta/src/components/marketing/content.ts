// Shared marketing copy: the eight steps every person goes through.

export const LOOP = [
  { t: "Understand", d: "Learn about the person, one small question at a time", live: true },
  { t: "Match", d: "Check every scheme and find what one claim opens up", live: true },
  { t: "Warn", d: "Flag any claim that could lower another", live: true },
  { t: "Act", d: "Put claims in order and prepare each call", live: true },
  { t: "Confirm", d: "Record what was awarded and help challenge a wrong decision", live: false },
  { t: "Receive", d: "Check the first payment arrives and is right", live: false },
  { t: "Keep", d: "Report changes on time so nothing has to be paid back", live: false },
  { t: "Watch", d: "Check again when life or the rules change", live: false },
] as const;

export const SOURCE_URL = "https://policyinpractice.co.uk/publication/missing-out-2025";
