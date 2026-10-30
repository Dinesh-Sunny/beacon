// Shows Beam's plain-text help with its known section headings as real headings (h3), so screen
// readers can jump between parts. Text is rendered as text, never as HTML.

const HEADINGS = new Set([
  "Next steps",
  "What to have ready",
  "What to say",
  "What it says",
  "What you need to do",
  "If you disagree",
  "Is it genuine?",
]);

export function SectionedText({ text }: { text: string }) {
  const parts: Array<{ heading?: string; body: string[] }> = [{ body: [] }];
  for (const line of text.split("\n")) {
    const bare = line.trim().replace(/:$/, "");
    if (HEADINGS.has(bare)) parts.push({ heading: bare, body: [] });
    else parts.at(-1)?.body.push(line);
  }
  return (
    <div className="stack gap-4">
      {parts
        .filter((p) => p.heading || p.body.join("").trim())
        .map((p) => (
          <div key={p.heading ?? "intro"} className="stack gap-1">
            {p.heading && <h3 className="t-title">{p.heading}</h3>}
            <p className="m-0 whitespace-pre-line">
              {p.body.join("\n").trim()}
            </p>
          </div>
        ))}
    </div>
  );
}
