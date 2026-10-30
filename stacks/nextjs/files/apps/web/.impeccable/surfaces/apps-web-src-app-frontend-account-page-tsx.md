---
version: 1
slug: "apps-web-src-app-frontend-account-page-tsx"
primary_target: "apps/web/src/app/(frontend)/account/page.tsx"
related_targets: ["apps/web/src/app/(frontend)/(auth)/sign-in/page.tsx"]
---

# Surface brief: auth screens and account home

Mode: Operate. Visitor: a client project's end customer (shopper, member, or organization admin) signing up, signing in, recovering access, or managing account and team. Success: the task finishes with no dead end; every error names the problem and the fix. World: the established shadcn preset (DESIGN.md), brand-neutral so client forks retheme through tokens. WCAG 2.2 AA. Copy follows VOICE.md.

Screens: sign up, check inbox, verify result, sign in (password or magic link), two-factor challenge, forgot password, reset password, invalid or expired link, accept invitation, two-factor setup, and /account as an app shell: Profile, Security (password, two-factor, devices), Team (organization switcher, members, invitations), API keys, and a danger zone for account deletion.

## Direction contract

THESIS: Auth is a split screen with a living brand panel; the account is a real app shell. It refuses the narrow plain column and the one long settings scroll the first pass shipped.
OWN-WORLD: Existing tokens only (white ground, mauve neutrals, violet primary, Merriweather headings, Inter body, Hugeicons stroke 2). Richness comes from the design-system catalog: a Magic UI flickering grid as a faint texture (hidden under reduced motion), Animate UI tabs with a sliding highlight, Hugeicons Animated icons (mail, shield, tick, copy, key), shadcn input-otp, Sidebar, Dialog, Table, DropdownMenu, Avatar, Empty. Motion respects reduced motion through MotionConfig.
STORY: Auth: the panel tells the visitor how the account is protected using only true facts from the auth config; the form side does one task with inline help (password toggle and strength, code slots, inbox shortcuts, resend cooldown). Account: the sidebar says where you are and which organization you act for; each page is a stack of composition cards with the current state up front.
FIRST VIEWPORT: Auth desktop: form column in the wider left 3/5 (max 24rem), brand mark and form on one left edge, heading at a fixed offset; quiet muted panel on the right 2/5 whose protection card top aligns with the heading. Primary colour is reserved for the next action, never for decoration; mobile: panel hidden, brand mark above the form. Account desktop: sidebar with org switcher on top, nav groups, user menu at the foot; content is a page header plus cards. Mobile: sidebar becomes an off-canvas sheet behind a trigger in a sticky top bar.
FORM: split auth plus sidebar app shell; replaces the continuous-sheet lock at the user's request ("best complex ones, wonderful UI UX"). Seed: none, no concept roll; the user directed the form.
HIERARCHY: The most salient element on every screen is its primary action; decoration stays quieter. Card actions sit in the header row (stacking under the description on phones) or under the fields, never in an empty footer band.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
