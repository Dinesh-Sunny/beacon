import type { Draft } from "./answers";

// The sample person from the design (kit11a PERSONAS.sample): Brent, born 1952, lives alone, council
// tenant, State Pension only, under the Pension Credit line, health condition. No real person.
export const EXAMPLE_DRAFT: Draft = {
  situation: {
    forSomeoneElse: false,
    postcodeDistrict: "HA9",
    nation: "england",
    council: "Brent",
    birthYear: 1952,
    household: "alone",
    benefits: [],
    home: "council-or-housing-association",
    pensionIncome: "under-line",
    savings: "under-10000",
    applies: ["health-condition"],
  },
  progress: {
    area: "done",
    "birth-year": "done",
    household: "done",
    benefits: "done",
    home: "done",
    money: "done",
    savings: "done",
    applies: "done",
    "anything-else": "done",
  },
  areaLabel: "Brent, London",
  elseChips: ["Stairs or walking"],
  elseText: "",
};
