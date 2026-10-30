"use server";

import { getTextStats, type TextStats } from "@/lib/python-api";

export type TextStatsState = {
  text: string; // echoed back so the field keeps its value after submit
  stats: TextStats | null;
  error: string | null;
};

export async function analyzeText(
  _prev: TextStatsState,
  formData: FormData,
): Promise<TextStatsState> {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) {
    return { text, stats: null, error: "Enter some text." };
  }
  try {
    return { text, stats: await getTextStats(text), error: null };
  } catch {
    return {
      text,
      stats: null,
      error: "The Python service is unavailable. Try again in a moment.",
    };
  }
}
