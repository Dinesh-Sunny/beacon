import { Fragment } from "react";
import { CallToActionBlock } from "@/components/site/blocks/CallToActionBlock";
import { FaqBlock } from "@/components/site/blocks/FaqBlock";
import { FeaturesBlock } from "@/components/site/blocks/FeaturesBlock";
import { HeroBlock } from "@/components/site/blocks/HeroBlock";
import { RichTextBlock } from "@/components/site/blocks/RichTextBlock";
import type { Page } from "@/payload-types";

type LayoutBlock = NonNullable<Page["layout"]>[number];

function renderBlock(block: LayoutBlock, index: number, className?: string) {
  switch (block.blockType) {
    case "hero":
      return (
        <HeroBlock block={block} headingLevel={index === 0 ? "h1" : "h2"} />
      );
    case "features":
      return <FeaturesBlock block={block} className={className} />;
    case "callToAction":
      return <CallToActionBlock block={block} className={className} />;
    case "richText":
      return <RichTextBlock block={block} className={className} />;
    case "faq":
      return <FaqBlock block={block} className={className} />;
    default: {
      // tsconfig has no noImplicitReturns, so this makes a new block type a type error.
      const unhandled: never = block;
      return unhandled;
    }
  }
}

// A page's sections in editor order. The switch is exhaustive (see `default`), so a new block
// type fails the type-check until it has a renderer.
export function RenderBlocks({
  blocks,
  firstBlockClassName,
}: {
  blocks: Page["layout"];
  // Lets a page title above the blocks sit close to the first one.
  firstBlockClassName?: string;
}) {
  if (!blocks?.length) return null;
  return blocks.map((block, index) => (
    <Fragment key={block.id ?? index}>
      {renderBlock(block, index, index === 0 ? firstBlockClassName : undefined)}
    </Fragment>
  ));
}
