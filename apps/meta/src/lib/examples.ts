// Made-up people for demos. No real person's details.
import type { Answers } from "@/engine/facts";

export interface Example {
  id: string;
  name: string;
  line: string;
  answers: Answers;
}

export const EXAMPLES: Example[] = [
  {
    id: "margaret",
    name: "Margaret, 78, Wembley",
    line: "Lives alone on her State Pension. Needs a hand getting dressed.",
    answers: { postcode: "HA9 0WS", dob: "1948-03-12", housing: "social", benefits: [], income: { amt: 210, per: "week" }, savings: 4000, difficulties: ["wash", "night"], work: { status: "none" }, ni: "no", child: "none", pregnant: "no", careHours: 0, ctax: "yes", bereaved: "no" },
  },
  {
    id: "aled",
    name: "Aled, 32, Cardiff",
    line: "New dad working 12 hours a week.",
    answers: { postcode: "CF10 1EP", dob: "1994-07-02", housing: "private", benefits: ["cb"], income: { amt: 1500, per: "month" }, savings: 2500, difficulties: [], work: { status: "employed", hours: 12 }, ni: "yes", child: "2026-06-10", pregnant: "no", careHours: 0, ctax: "yes", bereaved: "no" },
  },
  {
    id: "fiona",
    name: "Fiona, 46, Glasgow",
    line: "Cares for her brother 50 hours a week.",
    answers: { postcode: "G2 1DY", dob: "1980-02-01", housing: "social", benefits: ["uc"], income: { amt: 150, per: "week" }, savings: 800, difficulties: [], work: { status: "none" }, ni: "no", child: "none", pregnant: "no", careHours: 50, ctax: "yes", bereaved: "no" },
  },
];
