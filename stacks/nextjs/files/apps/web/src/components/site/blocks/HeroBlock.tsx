import Image from "next/image";
import { Actions } from "@/components/site/blocks/Actions";
import { DotBackdrop } from "@/components/site/DotBackdrop";
import { Section } from "@/components/site/Section";
import { cn } from "@/lib/utils";
import type { HeroBlock as HeroBlockData } from "@/payload-types";

type HeroImage = { src: string; alt: string; width?: number; height?: number };

// Media arrives populated at depth 1; an id string means it was deleted or not populated.
// Prefer the 1536px size generated at upload over the original.
function heroImage(media: HeroBlockData["media"]): HeroImage | null {
  if (!media || typeof media !== "object") return null;
  const feature = media.sizes?.feature;
  const src = feature?.url ?? media.url;
  if (!src) return null;
  return {
    src,
    alt: media.alt,
    width: (feature?.url ? feature.width : media.width) ?? undefined,
    height: (feature?.url ? feature.height : media.height) ?? undefined,
  };
}

export function HeroBlock({
  block,
  headingLevel,
}: {
  block: HeroBlockData;
  // The first block on a page carries the page's h1.
  headingLevel: "h1" | "h2";
}) {
  const image = heroImage(block.media);
  const Heading = headingLevel;
  return (
    <div className="relative isolate overflow-hidden">
      <DotBackdrop />
      <Section
        className={cn(
          "grid items-center gap-10 pt-20 pb-16 sm:pt-28 sm:pb-20 lg:gap-16",
          image && "lg:grid-cols-2",
        )}
      >
        <div className="flex max-w-3xl flex-col gap-6">
          <Heading className="font-heading text-4xl leading-tight text-balance sm:text-5xl lg:text-6xl">
            {block.heading}
          </Heading>
          {block.body && (
            <p className="max-w-prose text-lg text-muted-foreground text-pretty">
              {block.body}
            </p>
          )}
          <Actions actions={block.actions} prominent />
        </div>
        {image && (
          <Image
            {...image}
            sizes="(min-width: 1024px) 50vw, 100vw"
            preload={headingLevel === "h1"}
            className="aspect-4/3 w-full rounded-2xl border object-cover"
          />
        )}
      </Section>
    </div>
  );
}
