import type { Metadata } from "next";
import { Reading } from "@/components/results/Reading";

export const metadata: Metadata = { title: "Reading the rules" };

// Frame: Waits | Feeling: calm, trust. The hero is the reading plan.
export default function ReadingPage() {
  return <Reading />;
}
