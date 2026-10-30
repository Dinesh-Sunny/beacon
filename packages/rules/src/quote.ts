// The quote checker: a result can only say Likely when its quoted rule line is really on the page.
// Runs in code, never in the model.

/** Fold the differences that are not wording: case, whitespace, curly quotes, dashes, non-breaking spaces. */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface QuoteCheck {
  verified: boolean;
  /** Character offset in the normalised page, for "See this line on the page" */
  at: number;
}

/** A quote must be at least 6 words and appear word for word on the page (after normalising). */
export function verifyQuote(quote: string, pageText: string): QuoteCheck {
  const q = normalise(quote).replace(/^["']|["']$/g, "");
  if (q.split(" ").length < 6) return { verified: false, at: -1 };
  const at = normalise(pageText).indexOf(q);
  return { verified: at >= 0, at };
}

/** A GOV.UK text-fragment link that opens the page with the line highlighted. */
export function lineLink(url: string, quote: string): string {
  const words = quote.trim().split(/\s+/);
  const frag =
    words.length > 8
      ? `${words.slice(0, 4).join(" ")},${words.slice(-4).join(" ")}`
      : words.join(" ");
  return `${url}#:~:text=${encodeURIComponent(frag).replace(/%2C/g, ",")}`;
}
