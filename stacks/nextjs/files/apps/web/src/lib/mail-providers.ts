// Webmail inboxes we can open straight from "check your inbox". Unknown domains get no button.
const PROVIDERS = [
  {
    name: "Gmail",
    url: "https://mail.google.com/mail/u/0/#inbox",
    domains: ["gmail.com", "googlemail.com"],
  },
  {
    name: "Outlook",
    url: "https://outlook.live.com/mail/0/inbox",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
  },
  {
    name: "Yahoo Mail",
    url: "https://mail.yahoo.com",
    domains: ["yahoo.com", "ymail.com"],
  },
  {
    name: "iCloud Mail",
    url: "https://www.icloud.com/mail",
    domains: ["icloud.com", "me.com", "mac.com"],
  },
  {
    name: "Proton Mail",
    url: "https://mail.proton.me",
    domains: ["proton.me", "protonmail.com"],
  },
] as const;

export type MailProvider = { name: string; url: string };

export function mailProviderFor(email: string): MailProvider | undefined {
  const domain = email.split("@").at(-1)?.toLowerCase();
  return PROVIDERS.find((provider) =>
    (provider.domains as readonly string[]).includes(domain ?? ""),
  );
}
