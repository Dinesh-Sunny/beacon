#!/usr/bin/env bash
# Refresh this profile FROM a project that uses it (so profile improvements flow back to the template).
# Usage: capture.sh <project-dir> [--name <project-name>]   (name defaults to the root package.json name)
# Copies files.list entries into files/ (name → placeholders) and the Stack/Commands/Architecture
# sections of AGENTS.md into agents.sections.md. Review with `git diff` in the template afterwards.
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"
proj="$(cd "${1:?usage: capture.sh <project-dir> [--name N]}" && pwd)"
name="${3:-$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['name'])" "$proj/package.json")}"
pyname="${name//-/_}"
rm -rf "$P/files" && mkdir -p "$P/files"
# Git-tracked files only: never .env.local, node_modules, build output, or other untracked local state.
while IFS= read -r f; do
  [[ -z "$f" || "$f" == \#* ]] && continue
  tracked="$(git -C "$proj" ls-files -- "${f%/}")"
  [[ -n "$tracked" ]] || { echo "skip (not tracked): $f"; continue; }
  rsync -a --files-from=<(printf '%s\n' "$tracked") "$proj/" "$P/files/"
done < "$P/files.list"
python3 - "$P" "$name" "$pyname" "$proj" <<'PY'
import os, re, sys, pathlib
P, name, pyname, proj = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3], pathlib.Path(sys.argv[4])
files = P / "files"
def tokenize(s: str) -> str:
    s = s.replace(f"{pyname}_", "__PYNAME___")
    return re.sub(rf"\b{re.escape(name)}\b", "__NAME__", s)
for p in sorted(files.rglob("*"), key=lambda x: -len(x.parts)):
    if p.is_file():
        try:
            t = p.read_text()
        except UnicodeDecodeError:
            continue
        t = re.sub(r'^authors = \[\n(?:.*\n)*?\]\n', "", t, flags=re.M)  # never capture personal author data
        p.write_text(tokenize(t))
    if name in p.name or f"{pyname}_" in p.name:
        p.rename(p.with_name(tokenize(p.name)))
agents = (proj / "AGENTS.md").read_text()
m = re.search(r"(## Stack\n.*?)(?=\n## Conventions)", agents, re.S)
(P / "agents.sections.md").write_text(tokenize(m.group(1)).rstrip() + "\n")
print(f"captured {sum(1 for _ in files.rglob('*') if _.is_file())} files + AGENTS sections from {proj}")
PY
