#!/usr/bin/env bash
# PostToolUse (matcher: Edit|Write). Design tokens guard:
#   globals.css edited → regenerate apps/web/DESIGN.md so it mirrors globals.css
#   DESIGN.md token edited by hand → block (exit 2): change globals.css instead
#   UI file edited → block (exit 2) on hardcoded design values (colors, palette classes, arbitrary values, inline styles)
exec python3 "${CLAUDE_PROJECT_DIR:-.}/.claude/skills/design-system/scripts/design-tokens.py" hook
