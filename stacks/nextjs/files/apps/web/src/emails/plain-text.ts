import { plainTextSelectors, toPlainText } from "react-email";

// html-to-text upper-cases headings by default; VOICE.md wants sentence case everywhere.
export const HTML_TO_TEXT_OPTIONS = {
  selectors: [
    ...plainTextSelectors,
    { selector: "h1", options: { uppercase: false } },
  ],
};

// For HTML that arrives without a text part (Payload, plugins).
export function htmlToText(html: string): string {
  return toPlainText(html, HTML_TO_TEXT_OPTIONS);
}
