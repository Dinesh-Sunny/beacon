import { SITE } from "@/lib/site";

const UNITS = [
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
] as const;

// "30 days", "1 hour", "5 minutes": the largest unit that divides evenly, worded by Intl.
export function formatDuration(
  seconds: number,
  locale: string = SITE.language,
): string {
  const match = UNITS.find(
    ({ seconds: size }) => seconds >= size && seconds % size === 0,
  );
  const unit = match?.unit ?? "second";
  const value = match ? seconds / match.seconds : seconds;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
}

// Server-rendered timestamps use UTC and say so, rather than guessing the reader's timezone.
export function formatDateTime(
  value: Date | string,
  locale: string = SITE.language,
): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
  return `${formatted} UTC`;
}

// Calendar dates (renewals, plan ends): the day is what matters, so no time or zone.
export function formatDate(
  value: Date | string,
  locale: string = SITE.language,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}
