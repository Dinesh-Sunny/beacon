import { Actions } from "@/components/site/blocks/Actions";
import type { BlockProps } from "@/components/site/blocks/types";
import { SECTION_HEADING, Section } from "@/components/site/Section";
import type { CallToActionBlock as CallToActionBlockData } from "@/payload-types";

// A quiet muted band: the button carries the emphasis, not the surface.
export function CallToActionBlock({
  block,
  className,
}: BlockProps<CallToActionBlockData>) {
  return (
    <Section className={className}>
      <div className="flex flex-col gap-6 rounded-3xl bg-muted px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className={SECTION_HEADING}>{block.heading}</h2>
          {block.body && (
            <p className="text-foreground/75 text-pretty">{block.body}</p>
          )}
        </div>
        <Actions actions={block.actions} />
      </div>
    </Section>
  );
}
