// Markdown text helpers. Pure so `node --test` runs them.

// Editors type plain text; on the HTML page React escapes it, so Markdown syntax in it is
// escaped here to read the same: emphasis, links, code, and HTML anywhere, and list, heading,
// and quote markers at the start of a line. Ordinary punctuation stays readable.
const INLINE_SPECIAL = /[\\`*_[\]<>]/g;
const LINE_START_MARKER = /^(\s*)(?:([#>+-])|(\d+)([.)]))/gm;

export function escapeMarkdown(text: string): string {
  return text
    .replace(INLINE_SPECIAL, (character) => `\\${character}`)
    .replace(
      LINE_START_MARKER,
      (
        _match,
        indent: string,
        marker: string | undefined,
        digits: string | undefined,
        punctuation: string | undefined,
      ) =>
        // Digits can't be escaped in CommonMark; the `.` or `)` after them can.
        marker ? `${indent}\\${marker}` : `${indent}${digits}\\${punctuation}`,
    );
}

// Link targets in angle brackets, so spaces or parentheses in a URL can't end the link early.
export function markdownLink(label: string, url: string): string {
  return `[${escapeMarkdown(label)}](<${url}>)`;
}

// Site-relative link targets (`](/about)`) made absolute, for Markdown read out of context.
export function absoluteLinks(
  markdown: string,
  absolute: (path: string) => string,
): string {
  return markdown.replace(
    /\]\((\/[^)\s]*)\)/g,
    (_match, path: string) => `](<${absolute(path)}>)`,
  );
}
