import { HugeiconsIcon } from "@hugeicons/react";
import type { BlockProps } from "@/components/site/blocks/types";
import { FEATURE_ICON_GLYPHS } from "@/components/site/feature-icons";
import { SECTION_HEADING, Section } from "@/components/site/Section";
import type { FeaturesBlock as FeaturesBlockData } from "@/payload-types";

// Icon-led items on a hairline grid (catalog `feature-with-inline-icons`), not a wall of
// same-size cards. The icon sits inline with the title so six items stay compact on phones.
export function FeaturesBlock({
  block,
  className,
}: BlockProps<FeaturesBlockData>) {
  const headingId = block.id ? `features-${block.id}` : undefined;
  return (
    <Section
      aria-labelledby={block.heading ? headingId : undefined}
      className={className}
    >
      {(block.heading || block.body) && (
        <div className="mb-10 flex max-w-2xl flex-col gap-3 sm:mb-12">
          {block.heading && (
            <h2 id={headingId} className={SECTION_HEADING}>
              {block.heading}
            </h2>
          )}
          {block.body && (
            <p className="text-muted-foreground text-pretty">{block.body}</p>
          )}
        </div>
      )}
      <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3">
        {block.items.map((item) => (
          <li
            key={item.id ?? item.title}
            className="flex flex-col gap-2 border-t pt-5"
          >
            <h3 className="flex items-center gap-2.5 font-medium text-lg">
              {item.icon && (
                <HugeiconsIcon
                  icon={FEATURE_ICON_GLYPHS[item.icon]}
                  strokeWidth={2}
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              {item.title}
            </h3>
            {item.body && (
              <p className="text-muted-foreground text-pretty">{item.body}</p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
