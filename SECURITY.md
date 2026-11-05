# Security

Beacon handles sensitive moments in people's lives, so we take reports seriously.

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's private **Report a vulnerability** button on the Security tab of this repository instead. You'll get a reply within a few days.

## What Beacon is built to protect

- Beacon never asks for a name, full address, ID number, bank details, exact amounts or a full date of birth.
- Answers live in the person's browser. A shared check carries its answers in the link fragment, which browsers never send to a server.
- Personal details are removed by an open-weights model before any hosted model sees a message.
- Every model route has a per-IP rate limit, a daily cap and same-origin checks ([`guard.ts`](apps/meta/src/server/guard.ts)).
- Logs record model, tokens and timing, never the words someone typed.

If you find a way around any of these, we especially want to hear about it.
