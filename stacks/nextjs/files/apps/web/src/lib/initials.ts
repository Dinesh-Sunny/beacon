const MAX_INITIALS = 2;

// "Ada Lovelace" -> "AL", "acme" -> "A". Avatars fall back to these; there are no photos yet.
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
  return letters.slice(0, MAX_INITIALS).toUpperCase() || "?";
}
