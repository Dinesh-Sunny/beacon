import type { Metadata } from "next";
import { ResultsView } from "@/components/results/ResultsView";

export const metadata: Metadata = { title: "What may be yours" };

// Frame: Results | Feeling: relief.
export default function ResultsPage() {
  return <ResultsView />;
}
