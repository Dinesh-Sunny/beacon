# nextjs profile

| File | Role |
| --- | --- |
| `setup.sh` | Applies the profile: overlay files → pnpm install → uv sync → merge settings/MCP/.gitignore/AGENTS → design sync → format → `pnpm db:up` + `db:migrate` + `pnpm check` (lint + typecheck without Docker) |
| `capture.sh` | Refreshes `files/` and `agents.sections.md` from the agency repo (git-tracked files only) |
| `files.list` / `files/` | The agency base laid over the project (`__NAME__` / `__PYNAME__` placeholders). Versions are pinned by the captured lockfiles |
| `agents.sections.md` | AGENTS.md Stack / Commands / Architecture sections |
| `settings.fragment.json` | Permissions, hook env (formatter map, finish check, protected paths), MCP enablement, sandbox domains. Merged into `.claude/settings.json` |
| `mcp.fragment.json` | `next-devtools` and `shadcn` MCP servers, added to `.mcp.json` |
| `gitignore.fragment` | JS + Python ignores |

Source of truth: `~/CodeProjects/agency`. Never edit `files/` by hand; improve agency, then re-run `capture.sh ../agency`.
The original scaffold came from create-next-app and `pnpm dlx shadcn@latest init --preset b4XwA3eDL6 --base radix --template next --pointer`.
