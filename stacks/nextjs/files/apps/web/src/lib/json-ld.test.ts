import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "../payload-types.ts";
import { faqJsonLd } from "./json-ld.ts";

type Layout = NonNullable<Page["layout"]>;

const faq = (questions: Array<[string, string]>): Layout[number] => ({
  blockType: "faq",
  items: questions.map(([question, answer]) => ({ question, answer })),
});

describe("faqJsonLd", () => {
  test("should return nothing for a page without FAQ blocks", () => {
    assert.equal(faqJsonLd(null), null);
    assert.equal(faqJsonLd([{ blockType: "hero", heading: "Hello" }]), null);
  });

  test("should merge every FAQ block on a page into one FAQPage", () => {
    const result = faqJsonLd([
      faq([["How long?", "Six weeks."]]),
      { blockType: "hero", heading: "Hello" },
      faq([["Can I resize?", "Yes."]]),
    ]);
    assert.deepEqual(result, {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How long?",
          acceptedAnswer: { "@type": "Answer", text: "Six weeks." },
        },
        {
          "@type": "Question",
          name: "Can I resize?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    });
  });
});
