#!/usr/bin/env bash
# Design gate: runs Impeccable automatically on UI work, without the user asking.
# Wired to four events (same script, branches on hook_event_name):
#   SessionStart      → if PRODUCT.md / app DESIGN.md are missing, tell Claude to create them (init / document)
#   UserPromptSubmit  → reset per-request tracking; for UI requests, inject the Impeccable stage workflow
#   PostToolUse       → record UI files edited in this request (vendored code skipped)
#   Stop              → if UI files changed and the gate hasn't run for this request, block once and require
#                       /impeccable audit → fix → harden/polish → pnpm design:check before finishing
# Disable for a session with CLAUDE_DESIGN_GATE=0 (settings.json "env" or shell).
source "$(dirname "$0")/_lib.sh"
[[ "${CLAUDE_DESIGN_GATE:-1}" == "0" ]] && exit 0

event="$(json_get '.hook_event_name')"
session="$(json_get '.session_id')"
state_dir="$LOG_DIR/design-gate"
files="$state_dir/${session:-default}.files"
gated="$state_dir/${session:-default}.gated"
mkdir -p "$state_dir"

UI_RE='^apps/[^/]+/src/.*\.(tsx|jsx|css|scss)$'
VENDORED_RE='(/components/ui/|/design/_preview|/hooks/use-mobile\.ts$)'

case "$event" in
  SessionStart)
    [[ -d "$PROJECT_DIR/apps/web" ]] || exit 0
    missing=()
    [[ -f "$PROJECT_DIR/PRODUCT.md" ]] || missing+=("PRODUCT.md → run \`/impeccable init\` (interview the user; never invent product facts)")
    [[ -f "$PROJECT_DIR/apps/web/DESIGN.md" || -f "$PROJECT_DIR/DESIGN.md" ]] \
      || missing+=("apps/web/DESIGN.md → run \`/impeccable document\` for apps/web (records the shadcn preset)")
    if (( ${#missing[@]} )); then
      msg="Impeccable design context is missing. Before (or at the start of) the next UI task, proactively run:"
      for m in "${missing[@]}"; do msg+=$'\n- '"$m"; done
      add_context "SessionStart" "$msg"
    fi
    ;;

  UserPromptSubmit)
    : > "$files"; rm -f "$gated"   # new request → fresh tracking
    prompt="$(json_get '.prompt')"
    if printf '%s' "$prompt" | grep -Eiq '\b(ui|ux|page|screen|design|redesign|layout|component|form|dashboard|landing|modal|dialog|style|styling|theme|button|navbar|sidebar|onboarding|empty state|responsive|animation|polish)\b'; then
      add_context "UserPromptSubmit" "UI task detected. Apply the design-system skill and run Impeccable automatically (don't wait to be asked): \`/impeccable shape <page>\` for new work → build from ui/* + catalog → \`/impeccable harden\` + \`polish\` → \`/impeccable audit <page>\`. Always name the page. Stage map: .claude/skills/design-system/impeccable.md"
    fi
    ;;

  PostToolUse)
    file="$(json_get '.tool_input.file_path')"
    [[ -z "$file" ]] && exit 0
    rel="${file#"$PROJECT_DIR"/}"
    if [[ "$rel" =~ $UI_RE ]] && ! [[ "$rel" =~ $VENDORED_RE ]]; then
      grep -qxF "$rel" "$files" 2>/dev/null || echo "$rel" >> "$files"
      log "ui-edit $rel"
    fi
    ;;

  Stop)
    [[ "$(json_get '.stop_hook_active')" == "true" ]] && exit 0
    [[ -s "$files" && ! -f "$gated" ]] || exit 0
    touch "$gated"   # gate once per request; edits made while fixing don't re-trigger it
    list="$(sed 's/^/- /' "$files")"
    jq -n --arg r "UI files changed in this request:
$list

Before finishing, run Impeccable automatically (no need to ask the user):
1. \`/impeccable audit <page>\` for each affected page/route; fix P0/P1 findings.
2. \`/impeccable harden\` (states from the UX matrix) and \`/impeccable polish\` on the same pages.
3. \`pnpm design:check\` must exit 0.
Then summarize what Impeccable found and fixed." '{decision:"block",reason:$r}'
    ;;
esac
exit 0
