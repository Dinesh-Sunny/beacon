<!-- last-verified: 2026-10-02 -->
# Email

How the template sends transactional email: one mailer for app and CMS emails, Amazon SES in deployed environments, the server log locally. Read before adding an email, changing a template, or setting up SES for a project.

## Pieces

| Piece | Where | Job |
| --- | --- | --- |
| `@__NAME__/email` | `packages/email` | Brand-free `Mailer`: SES v2 transport, dev transport, `createMailer()` picks one from env |
| Templates | `apps/web/src/emails/` | React Email 6: `EmailLayout` frame, `ActionEmail` (one-button emails), words in `auth-copy.ts` and `cms-copy.ts`, `render.tsx` |
| Mailer instance | `apps/web/src/lib/mailer.ts` | Lazy `getMailer()`, so builds need no email env |
| Auth sender | `apps/web/src/lib/auth-email.ts` | Renders the auth email, records the dev outbox link, sends |
| Payload adapter | `apps/web/src/payload/email.ts` | Payload and plugin emails use the same mailer (tag `cms`): one message per to/cc/bcc recipient, text part derived from HTML, attachments refused |
| CMS reset email | `apps/web/src/payload/reset-email.ts` | Editor password reset with our template and an absolute link (Payload's default link is relative without `serverURL`) |
| Previews | `/api/dev/emails/<kind>` (`?format=text`) | Dev only, 404 in production |

## Transport selection

- `EMAIL_FROM` and `AWS_SES_REGION` set: SES, in any environment (so a staging preview can send for real).
- Otherwise the dev transport (prints the plain-text part, which holds the links) outside production.
- Production without SES config: Better Auth and Payload still boot, but every send throws `EmailNotConfiguredError`. Better Auth sends most auth emails in the background and only logs that error, so users see "check your inbox" and get nothing. `getAuth()` logs a startup error and `/api/health` returns 503 with `email: "unconfigured"`.
- A failed auth email is queued as a `send-auth-email` job and retried for a few minutes (docs/knowledge/jobs.md); after that the failed job stays 14 days for inspection.

## Rules

- Render every email to HTML and plain text (`render(..., { plainText: true })`); spam filters and some clients want both.
- Colors come from `globals.css` through `EMAIL_THEME` (`apps/web/src/emails/theme.ts`): use semantic classes (`bg-primary`), never literals. Email clients don't read CSS variables, so the theme holds hex values computed from the tokens.
- Keep `pixelBasedPreset` on `<Tailwind>`: email clients don't support rem.
- `globals.css` is read at request time, so `next.config.ts` adds it to every route's trace. Keep that include if the file moves.
- Every message carries a `kind`, sent as the SES `kind` tag; optional `tags` add more (tenant, order). Names and values: letters, numbers, `_`, `-`. Every transport checks them, so a bad kind fails locally.
- Copy follows VOICE.md; `pnpm copy:check` scans the templates and the `.ts` copy modules in `apps/web/src/emails/`. State expiry windows from config constants, never as typed numbers.
- Keep user-typed text (names, organization names) out of subjects and preview lines; in the body it goes through `displayName()` (one line, control and bidi characters removed, 60 characters).
- The dev transport and dev outbox log live sign-in links. Neither runs in production; don't add another path that logs message bodies.

## SES setup per project

1. Verify the sending domain in the SES region closest to the database (Easy DKIM, plus a custom MAIL FROM subdomain for SPF alignment). Publish a DMARC record (`p=none` first, then tighten).
2. Request production access: new accounts are in the SES sandbox and can only send to verified addresses.
3. Create an IAM user (or role) allowed only `ses:SendEmail` on that identity; set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in Vercel. Vercel OIDC role federation would remove the long-lived keys (follow-up: needs `@vercel/oidc-aws-credentials-provider`).
4. Optional: a configuration set (`AWS_SES_CONFIGURATION_SET`) with an event destination for bounces and complaints. SES's account-level suppression list already stops sends to hard-bouncing addresses. Keep click and open tracking off on it: click tracking rewrites every link and records the original URL, which would copy live sign-in and reset tokens into the event destination.
5. Set `EMAIL_FROM` (e.g. `__NAME__ <hello@mail.example.com>`) and `AWS_SES_REGION`.

## Later phases

- Render tests: Node's test runner can't load `.tsx` or the `@/` alias, so templates are checked through `/api/dev/emails/<kind>` (`?sample=hostile` for hostile names) until apps/web gets a TSX test runner.
- Bounce and complaint events into the app (SNS → webhook), with marketing email (Listmonk on SES).
- Per-tenant sender domains: one SES identity per tenant plus SES Tenants; `EmailMessage.from` already overrides the sender.
- Receipts, abandoned-cart, and other commerce emails reuse `EmailLayout`.
