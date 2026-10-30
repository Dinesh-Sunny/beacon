// Actions that remove the control holding focus (delete a key, remove a member, turn off
// two-factor) would drop keyboard users on <body> and their confirmation would never be heard.
// They announce through one always-present live region and move focus to the page heading.
export const ANNOUNCER_ID = "account-announcer";

export function announce(message: string): void {
  const region = document.getElementById(ANNOUNCER_ID);
  if (region) region.textContent = message;
}

export function focusPageHeading(): void {
  document.querySelector<HTMLElement>("main h1")?.focus();
}
