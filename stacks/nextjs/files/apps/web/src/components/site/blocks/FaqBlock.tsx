import type { BlockProps } from "@/components/site/blocks/types";
import { SECTION_HEADING, Section } from "@/components/site/Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FaqBlock as FaqBlockData } from "@/payload-types";

export function FaqBlock({ block, className }: BlockProps<FaqBlockData>) {
  const headingId = block.id ? `faq-${block.id}` : undefined;
  return (
    <Section
      aria-labelledby={block.heading ? headingId : undefined}
      className={cn("grid gap-8 lg:grid-cols-3 lg:gap-16", className)}
    >
      {block.heading && (
        <h2 id={headingId} className={SECTION_HEADING}>
          {block.heading}
        </h2>
      )}
      <Accordion
        type="multiple"
        className={cn(
          "max-w-prose",
          block.heading ? "lg:col-span-2" : "lg:col-span-3",
        )}
      >
        {block.items.map((item) => (
          <AccordionItem
            key={item.id ?? item.question}
            value={item.id ?? item.question}
          >
            <AccordionTrigger className="items-center text-base">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="whitespace-pre-line text-base text-muted-foreground text-pretty motion-reduce:animate-none">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
