import type { JsonLdThing } from "@/lib/structured-data";

type JsonLdProps = { items: ReadonlyArray<JsonLdThing> };

// Escaping "<" keeps a stray "</script>" in any string value from closing the tag early (XSS).
function serialize(items: ReadonlyArray<JsonLdThing>): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": items,
  }).replace(/</g, "\\u003c");
}

// Native <script>, not next/script: JSON-LD is data, not executable code (per the Next.js JSON-LD guide).
export function JsonLd({ items }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be raw text; serialize() escapes "<".
      dangerouslySetInnerHTML={{ __html: serialize(items) }}
    />
  );
}
