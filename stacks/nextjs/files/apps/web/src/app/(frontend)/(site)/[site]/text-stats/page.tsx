import type { Metadata } from "next";
import { Section } from "@/components/site/Section";
import { TextStatsForm } from "@/components/TextStatsForm";
import { pageMetadata } from "@/lib/metadata";
import { ogImagePath } from "@/lib/og";
import { TEXT_STATS_PAGE } from "./constants";

export const metadata: Metadata = pageMetadata({
  ...TEXT_STATS_PAGE,
  image: ogImagePath(TEXT_STATS_PAGE.path.slice(1)),
});

export default function TextStatsPage() {
  return (
    <Section className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-heading text-2xl">{TEXT_STATS_PAGE.title}</h1>
      <p className="text-muted-foreground">{TEXT_STATS_PAGE.description}</p>
      <TextStatsForm />
    </Section>
  );
}
