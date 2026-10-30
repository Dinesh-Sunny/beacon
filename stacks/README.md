# Stack profiles

For anyone applying or maintaining a stack profile. A profile turns this stack-neutral template into a ready project for one stack. It carries the code, settings, rules, skills and CI, captured from a real project that keeps them working (for `nextjs`, the agency repo).

| Profile | What you get |
| --- | --- |
| [`nextjs`](nextjs/) | The full agency base: pnpm + uv monorepo · Next.js 16 (`apps/web`) with shadcn/ui preset `b4XwA3eDL6` and `DESIGN.md` · Payload CMS · Better Auth (orgs, 2FA, API keys) · Postgres via Drizzle · Stripe billing + commerce · email (SES) · rate limits (Upstash) · observability · consent · compliance · multi-tenancy · AI backend (LangGraph sidecar) · CI |

## Use
```bash
# From the playbook in one step (recommended):
~/CodeProjects/ai-playbook/bin/new-project.sh ~/CodeProjects/my-app --stack nextjs --name my-app

# After "Use this template" (the profile is inside the project and removes itself once applied):
./stacks/nextjs/setup.sh . --name my-app
```
Needs node ≥24, pnpm, uv, python3 and rsync. Start Docker first so setup can run migrations and the full `pnpm check`.

## Evolve a profile
The profile is never edited by hand. Change the source project (`~/CodeProjects/agency`), merge it there, then capture:
```bash
cd ~/CodeProjects/claude-project-template && git switch -c chore/capture-<topic>
stacks/nextjs/capture.sh ~/CodeProjects/agency   # tracked files in files.list + AGENTS sections; name → placeholders
git diff                                         # review; check that no project name leaked
```
Then confirm a clean run before merging. Stop other projects' containers first, since they share the ports:
```bash
~/CodeProjects/ai-playbook/bin/new-project.sh <scratch-dir> --stack nextjs --name some-longer-name
```
Use a name longer than `agency`, because the name ends up inside lines that the linters check. Commit, PR and merge, then delete the scratch dir (`docker compose down -v` in it first).

Notes:
- Settings, MCP and `.gitignore` fragments are edited by hand here. Versions come from the captured lockfiles.
- Capture swaps every whole-word `agency` for `__NAME__`, including prose. Check the diff for words like this (for example in `docs/knowledge/template-modules.md`) and put them back.
- Some packages are held back on purpose (Payload pins, peer limits, c15t v3). The reasons are in the captured `docs/knowledge/` and in agency PR #34.
