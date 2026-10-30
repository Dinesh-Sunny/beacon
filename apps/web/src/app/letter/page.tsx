import type { Metadata } from "next";
import { LetterExplainer } from "@/components/letter/LetterExplainer";

export const metadata: Metadata = { title: "Explain my letter" };

// S-090 / S-091: paste a letter, get its plain meaning, deadline, next step and scam signs.
export default function LetterPage() {
  return <LetterExplainer />;
}
