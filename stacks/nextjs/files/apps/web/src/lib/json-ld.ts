import type { Page } from "../payload-types.ts";

// JSON-LD built from CMS content. Pure (type imports only) so `node --test` runs it as-is;
// site-identity builders that read SITE live in structured-data.ts.
export type JsonLdThing = { "@type": string } & Record<string, unknown>;

// One FAQPage per page, from every FAQ block on it (Google reads one per URL).
export function faqJsonLd(layout: Page["layout"]): JsonLdThing | null {
  const questions = (layout ?? []).flatMap((block) =>
    block.blockType === "faq" ? block.items : [],
  );
  if (questions.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
