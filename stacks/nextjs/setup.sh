#!/usr/bin/env bash
# Apply the nextjs stack profile to a project created from claude-project-template.
# Result: the agency base captured by capture.sh: pnpm + uv monorepo · apps/web (Next.js, Payload CMS,
#         Better Auth, shadcn/ui) · packages/* · python/core + private python/api sidecar · Claude Code
#         settings, MCP, rules, skills, AGENTS.md sections, CI. Ends with `pnpm check` (tests need Docker).
# Usage: stacks/nextjs/setup.sh [project-dir] [--name <name>]
#   project-dir defaults to the current directory; name defaults to the directory name.
# Requires: node ≥24, pnpm, uv, python3, rsync; Docker for the local Postgres + Redis used by tests.
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"
ARGS=("$@")

target="."; name=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) name="$2"; shift 2 ;;
    *) target="$1"; shift ;;
  esac
done
target="$(cd "$target" && pwd)"
# Running from inside the project ("Use this template" copy)? Relocate the profile to a temp dir, remove
# stacks/ from the project (its files would confuse Biome/ruff), and re-run from the temp copy.
if [[ "$P" == "$target/stacks/"* && -z "${PROFILE_RELOCATED:-}" ]]; then
  tmp="$(mktemp -d)"; cp -R "$P" "$tmp/"; rm -rf "$target/stacks"
  PROFILE_RELOCATED=1 exec "$tmp/$(basename "$P")/setup.sh" "${ARGS[@]}"
fi
name="${name:-$(basename "$target")}"
name="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+|-+$//g')"
pyname="${name//-/_}"

step() { printf '\n\033[36m▶ %s\033[0m\n' "$*"; }
die() { echo "✗ $*" >&2; exit 1; }
for tool in node pnpm uv python3 rsync; do command -v "$tool" >/dev/null || die "missing tool: $tool"; done
[[ -d "$target/.claude" ]] || die "$target is not a claude-project-template project (no .claude/)"
[[ -e "$target/apps/web" ]] && die "$target/apps/web already exists. The profile is for fresh projects"

cd "$target"
step "Profile files → $target (name: $name)"
rsync -a "$P/files/" "$target/"
python3 - "$target" "$name" "$pyname" "$P/files" <<'PY'
import pathlib, sys
root, name, pyname, files = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3], pathlib.Path(sys.argv[4])
for src in files.rglob("*"):
    if src.is_symlink() or not src.is_file():
        continue
    p = root / src.relative_to(files)
    try:
        p.write_text(p.read_text().replace("__PYNAME__", pyname).replace("__NAME__", name))
    except UnicodeDecodeError:
        pass
for p in sorted(root.rglob("*__PYNAME__*"), key=lambda x: -len(x.parts)):
    p.rename(p.with_name(p.name.replace("__PYNAME__", pyname)))
PY

step "pnpm install"
pnpm install
pnpm env:init
# Payload and Better Auth refuse to start without these; give this machine its own random values.
python3 - <<'PY'
import pathlib, re, secrets
env = pathlib.Path("apps/web/.env.local")
s = env.read_text()
for key in ("PAYLOAD_SECRET", "BETTER_AUTH_SECRET", "CRON_SECRET"):
    s = re.sub(rf"^{key}=$", lambda _: f"{key}={secrets.token_hex(32)}", s, flags=re.M)
env.write_text(s)
PY

step "uv sync (Python workspace)"
uv sync --all-packages

step "Claude Code: settings, MCP, .gitignore, AGENTS.md"
python3 - "$P" <<'PY'
import json, pathlib, re, sys
P = pathlib.Path(sys.argv[1])
def union(a, b): return a + [x for x in b if x not in a]

sp = pathlib.Path(".claude/settings.json"); s = json.loads(sp.read_text()); f = json.loads((P / "settings.fragment.json").read_text())
for k in ("allow", "ask", "deny"):
    s["permissions"][k] = union(s["permissions"].get(k, []), f["permissions"][k])
for k, v in f["env"].items():
    if k.startswith("+"):
        k = k[1:]; s["env"][k] = s["env"].get(k, "") + v
    else:
        s["env"][k] = v
s["enabledMcpjsonServers"] = union(s.get("enabledMcpjsonServers", []), f["enabledMcpjsonServers"])
for key in ("extraKnownMarketplaces", "enabledPlugins"):  # plugins the profile relies on (e.g. Impeccable)
    s[key] = {**s.get(key, {}), **f.get(key, {})}
for event, groups in f.get("hooks", {}).items():  # profile hooks (e.g. design gate), appended once
    cur = s.setdefault("hooks", {}).setdefault(event, [])
    for g in groups:
        if g not in cur:
            cur.append(g)
net = s.setdefault("sandbox", {}).setdefault("network", {})
net["allowedDomains"] = union(net.get("allowedDomains", []), f["sandbox"]["network"]["allowedDomains"])
sp.write_text(json.dumps(s, indent=2) + "\n")

mp = pathlib.Path(".mcp.json"); m = json.loads(mp.read_text())
m["mcpServers"] = {**json.loads((P / "mcp.fragment.json").read_text()), **m["mcpServers"]}
mp.write_text(json.dumps(m, indent=2) + "\n")

gi = pathlib.Path(".gitignore"); g = gi.read_text(); frag = (P / "gitignore.fragment").read_text()
if ".impeccable/config.local.json" not in g:
    frag = ".impeccable/config.local.json\n" + frag
marker = "# TODO(stub): stack-specific ignores"
g = re.sub(rf"{re.escape(marker)}.*\n", frag, g) if marker in g else g.rstrip() + "\n\n" + frag
gi.write_text(g)
PY
python3 - "$P" "$name" "$pyname" <<'PY'
import json, pathlib, re, sys
P, name, pyname = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
sections = (P / "agents.sections.md").read_text().replace("__PYNAME__", pyname).replace("__NAME__", name)
ap = pathlib.Path("AGENTS.md"); a = ap.read_text()
a = re.sub(r"## Stack\n.*?(?=\n## Conventions)", lambda _: sections.rstrip() + "\n", a, flags=re.S)
a = a.replace("{{PROJECT_NAME}}", name)
for stub, value in json.loads((P / "agents.stubs.json").read_text()).items():
    if stub.startswith("{{"):
        a = a.replace(stub, value)
ap.write_text(a)
PY

step "Impeccable plugin (design skill + automatic design hooks)"
if command -v claude >/dev/null 2>&1; then
  claude plugin marketplace add pbakaus/impeccable >/dev/null 2>&1 || true
  claude plugin install impeccable@impeccable --scope project 2>&1 | tail -1 || true
else
  echo "claude CLI not found: the plugin installs on first session (declared in .claude/settings.json)"
fi

step "DESIGN.md (generated mirror of globals.css)"
pnpm design:sync

step "Format, regenerate context adapters"
pnpm exec biome check --write . >/dev/null || true
uv run ruff format . >/dev/null
python3 .claude/scripts/ctx.py sync >/dev/null
python3 .claude/scripts/ctx.py registry >/dev/null

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  step "Local Postgres + Redis, migrations, verify"
  pnpm db:up
  pnpm db:migrate
  pnpm check
else
  step "Verify without Docker: lint + typecheck (later: pnpm db:up && pnpm db:migrate && pnpm check)"
  pnpm lint && pnpm typecheck
fi


cat <<MSG

✓ nextjs profile applied to $target
  pnpm dev        Next.js on http://localhost:3000   (CMS admin: /admin)
  pnpm dev:py     Python sidecar on http://127.0.0.1:8000 (docs at /docs)
  pnpm check      lint → typecheck → test
Next: secrets in apps/web/.env.local, this project's PRODUCT.md and VOICE.md,
      remaining {{...}} stubs (grep -rn "{{" AGENTS.md .claude/rules), then commit.
MSG
