import type { Metadata } from "next";
import { CheckFlow } from "@/components/check/CheckFlow";

export const metadata: Metadata = { title: "Your check" };

// Frame: Tells story | Feeling: heard. One question per screen.
export default function CheckPage() {
  return <CheckFlow />;
}
