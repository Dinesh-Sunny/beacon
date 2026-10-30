// Same-site path check for `next` redirects. Pure (no imports) so `node --test` runs it as-is.
// Mirrors Better Auth's isSafeRelativeURL: browsers strip tabs and newlines and treat "\" as
// "/", so "/\t/evil.example" or "/\evil.example" would otherwise leave the site.
const PLACEHOLDER_ORIGIN = "https://same-site.invalid";
const LAST_CONTROL_CODE = 0x1f;
const DELETE_CODE = 0x7f;

function hasUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === "\\" || code <= LAST_CONTROL_CODE || code === DELETE_CODE)
      return true;
  }
  return false;
}

export function isSafeRelativePath(value: string): boolean {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    hasUnsafeCharacter(value)
  ) {
    return false;
  }
  try {
    return new URL(value, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}
