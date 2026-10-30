export type Address = { name?: string; address: string };

// "__NAME__ <hello@mail.example.com>", '"Doe, Jane" <jane@x.com>', or a bare address → its parts.
export function parseAddress(value: string): Address {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match?.[2]) return { address: value.trim() };
  const name = match[1]?.replace(/^"(.*)"$/, "$1").trim();
  return name
    ? { name, address: match[2].trim() }
    : { address: match[2].trim() };
}

// Splits a comma-separated recipient list without breaking quoted names ("Doe, Jane") or the
// angle-bracketed address.
export function parseAddressList(value: string): Address[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let bracketed = false;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "<") bracketed = true;
    else if (ch === ">") bracketed = false;
    if (ch === "," && !quoted && !bracketed) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseAddress);
}
