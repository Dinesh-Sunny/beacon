#!/usr/bin/env python3
"""Keep apps/web/DESIGN.md an exact mirror of apps/web/src/app/globals.css, and forbid hardcoded design values.

globals.css is the single source of truth (shadcn + Tailwind read it). DESIGN.md's YAML frontmatter and its
GENERATED blocks are derived from it; prose sections (Overview, Do's and Don'ts, …) are preserved.

  design-tokens.py sync [ROOT]          regenerate DESIGN.md tokens from globals.css (creates the file if missing)
  design-tokens.py check [ROOT]         exit 1 if DESIGN.md drifted from globals.css, or hardcoded values exist
  design-tokens.py lint [FILE...]       report hardcoded design values (default: all non-vendored UI files)
  design-tokens.py hook                 PostToolUse mode (stdin JSON): globals.css → sync · DESIGN.md → verify · UI file → lint

Allow a deliberate exception on one line with a comment containing `design-allow: <reason>`. Stdlib only.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or ".").resolve()
APP = "apps/web"
CSS = Path(APP) / "src/app/globals.css"
LAYOUT = Path(APP) / "src/lib/fonts.ts"  # next/font declarations (shared by root layouts)
DESIGN = Path(APP) / "DESIGN.md"
UI_GLOBS = (
    f"{APP}/src/**/*.tsx",
    f"{APP}/src/**/*.ts",
    f"{APP}/src/**/*.css",
    "packages/*/src/**/*.tsx",
    "packages/*/src/**/*.css",
)
VENDORED = re.compile(
    r"/components/ui/|/design/_preview|/hooks/use-mobile\.ts$|/components/animate-ui/|/components/assistant-ui/elements/"
)
FONT_FALLBACK = {
    "Inter": "sans-serif",
    "Merriweather": "serif",
    "Geist": "sans-serif",
    "Geist Mono": "monospace",
}

# ----------------------------------------------------------------------------- parse globals.css


def css_block(css: str, selector: str) -> dict[str, str]:
    m = re.search(rf"(?m)^{re.escape(selector)}\s*\{{(.*?)^\}}", css, re.S)
    return dict(re.findall(r"--([\w-]+)\s*:\s*([^;]+);", m.group(1))) if m else {}


def rem(value: str) -> float:
    v = value.strip()
    if v.endswith("rem"):
        return float(v[:-3])
    if v.endswith("px"):
        return float(v[:-2]) / 16
    raise ValueError(f"unsupported length {value!r}")


def fmt_rem(x: float) -> str:
    return f"{round(x, 4):g}rem"


def parse_tokens(root: Path) -> dict:
    css = (root / CSS).read_text()
    light, dark, theme = (
        css_block(css, ":root"),
        css_block(css, ".dark"),
        css_block(css, "@theme inline"),
    )
    colors = {k: v.strip() for k, v in light.items() if k != "radius"}
    dark_colors = {k: v.strip() for k, v in dark.items() if k != "radius"}
    base = rem(light.get("radius", "0.5rem"))
    rounded: dict[str, str] = {}
    for k, v in theme.items():
        if not k.startswith("radius-"):
            continue
        v = v.strip()
        if v == "var(--radius)":
            rounded[k[7:]] = fmt_rem(base)
        elif m := re.fullmatch(r"calc\(var\(--radius\)\s*\*\s*([\d.]+)\)", v):
            rounded[k[7:]] = fmt_rem(base * float(m.group(1)))
        elif m := re.fullmatch(r"calc\(var\(--radius\)\s*([-+])\s*([\d.]+(?:px|rem))\)", v):
            rounded[k[7:]] = fmt_rem(base + (1 if m.group(1) == "+" else -1) * rem(m.group(2)))
    # fonts: @theme --font-<role>: var(--x)  +  fonts.ts  Font({ variable: "--x" })
    layout = (root / LAYOUT).read_text() if (root / LAYOUT).exists() else ""
    var_to_family = {
        var: re.sub(r"_", " ", fn)
        for fn, var in re.findall(
            r"=\s*(\w+)\(\{[^}]*?variable:\s*[\"'](--[\w-]+)[\"']", layout, re.S
        )
    }
    roles = {"sans": "body", "heading": "heading", "mono": "mono"}
    typography = {}
    for role_var, role in roles.items():
        src = theme.get(f"font-{role_var}", "").strip()
        m = re.fullmatch(r"var\((--[\w-]+)\)", src)
        fam = var_to_family.get(m.group(1)) if m else None
        if fam:
            typography[role] = {"fontFamily": f"{fam}, {FONT_FALLBACK.get(fam, 'sans-serif')}"}
    return {
        "colors": colors,
        "dark": dark_colors,
        "rounded": rounded,
        "typography": typography,
        "radius": light.get("radius", ""),
    }


def component_tokens(root: Path, tokens: dict) -> dict:
    """Derive a few component mappings from the actual shadcn sources (only what is verifiable)."""
    out: dict[str, dict] = {}
    radius_keys = set(tokens["rounded"])

    def classes(path: str, pattern: str) -> str:
        p = root / APP / "src/components/ui" / path
        if not p.exists():
            return ""
        m = re.search(pattern, p.read_text(), re.S)
        return m.group(1) if m else ""

    def build(cls: str) -> dict:
        d: dict[str, str] = {}
        if m := re.search(r"(?<![\w:-])bg-([a-z-]+)(?![\w/-])", cls):
            if m.group(1) in tokens["colors"]:
                d["backgroundColor"] = f"{{colors.{m.group(1)}}}"
        if m := re.search(r"(?<![\w:-])text-([a-z-]+)(?![\w/-])", cls):
            if m.group(1) in tokens["colors"]:
                d["textColor"] = f"{{colors.{m.group(1)}}}"
        if m := re.search(r"(?<![\w:-])rounded-([a-z0-9]+)(?![\w/-])", cls):
            if m.group(1) in radius_keys:
                d["rounded"] = f"{{rounded.{m.group(1)}}}"
        return d

    btn_base = classes("button.tsx", r"cva\(\s*\"([^\"]+)\"")
    for variant in ("default", "secondary", "outline", "destructive"):
        v = classes("button.tsx", rf"\b{variant}:\s*\n?\s*\"([^\"]+)\"")
        d = build(f"{btn_base} {v}")
        if d:
            out[f"button-{'primary' if variant == 'default' else variant}"] = d
    card = build(classes("card.tsx", r"data-slot=\"card\"\s+className=\{cn\(\s*\"([^\"]+)\""))
    if card:
        out["card"] = card
    inp = build(classes("input.tsx", r"className=\{cn\(\s*\"([^\"]+)\""))
    if inp:
        out["input"] = inp
    return out


# ----------------------------------------------------------------------------- render DESIGN.md


def yaml_scalar(v) -> str:
    return json.dumps(v) if isinstance(v, str) else str(v)


def render_frontmatter(t: dict, comps: dict, name: str, description: str) -> str:
    lines = [
        "---",
        f"name: {yaml_scalar(name)}",
        f"description: {yaml_scalar(description)}",
        "# GENERATED from apps/web/src/app/globals.css by design-tokens.py. Edit globals.css, never these values.",
        "colors:",
    ]
    lines += [f"  {k}: {yaml_scalar(v)}" for k, v in t["colors"].items()]
    lines += [f"  {k}-dark: {yaml_scalar(v)}" for k, v in t["dark"].items()]
    if t["typography"]:
        lines.append("typography:")
        for role, props in t["typography"].items():
            lines.append(f"  {role}:")
            lines += [f"    {pk}: {yaml_scalar(pv)}" for pk, pv in props.items()]
    if t["rounded"]:
        lines.append("rounded:")
        lines += [f"  {k}: {yaml_scalar(v)}" for k, v in t["rounded"].items()]
    if comps:
        lines.append("components:")
        for cname, props in comps.items():
            lines.append(f"  {cname}:")
            lines += [f"    {pk}: {yaml_scalar(pv)}" for pk, pv in props.items()]
    lines.append("---")
    return "\n".join(lines) + "\n"


def gen_blocks(t: dict, comps: dict) -> dict[str, str]:
    colors = ["| Token | Tailwind | Light | Dark |", "| --- | --- | --- | --- |"]
    colors += [
        f"| `--{k}` | `bg-{k}` / `text-{k}` | `{v}` | `{t['dark'].get(k, '-')}` |"
        for k, v in t["colors"].items()
    ]
    typo = ["| Role | Tailwind | Font |", "| --- | --- | --- |"]
    cls = {"body": "font-sans", "heading": "font-heading", "mono": "font-mono"}
    typo += [f"| {r} | `{cls[r]}` | {p['fontFamily']} |" for r, p in t["typography"].items()]
    typo += [
        "",
        "Type sizes, weights, and leading use the Tailwind 4 default scale (`text-xs` … `text-9xl`, `font-*`, `leading-*`).",
    ]
    shapes = [
        f"Base radius `--radius: {t['radius']}`.",
        "",
        "| Token | Tailwind | Value |",
        "| --- | --- | --- |",
    ]
    shapes += [f"| `--radius-{k}` | `rounded-{k}` | {v} |" for k, v in t["rounded"].items()]
    comp = ["| Component | Tokens |", "| --- | --- |"]
    comp += [
        f"| `{c}` | " + ", ".join(f"{k}: `{v}`" for k, v in p.items()) + " |"
        for c, p in comps.items()
    ]
    comp += [
        "",
        "Components come from `src/components/ui` (shadcn, vendored). Compose them; never restyle with literals.",
    ]
    return {
        "colors": "\n".join(colors),
        "typography": "\n".join(typo),
        "shapes": "\n".join(shapes),
        "components": "\n".join(comp),
    }


SKELETON = """
# Design System: {name}

## Overview
<!-- Prose owned by people and Impeccable (`/impeccable document` refines this section). Not generated. -->
shadcn/ui preset b4XwA3eDL6: style vega, base radix, theme violet on mauve, emerald charts, Merriweather headings,
Inter body, Hugeicons. Live reference: the internal /design page.

## Colors
<!-- GENERATED:colors:start -->
<!-- GENERATED:colors:end -->

## Typography
<!-- GENERATED:typography:start -->
<!-- GENERATED:typography:end -->

## Layout
Spacing uses the Tailwind 4 scale (`--spacing` = 0.25rem steps: `p-4`, `gap-6`, …). No pixel values.
Mobile-first from 360px; standard breakpoints `sm` `md` `lg` `xl` `2xl`.

## Shapes
<!-- GENERATED:shapes:start -->
<!-- GENERATED:shapes:end -->

## Components
<!-- GENERATED:components:start -->
<!-- GENERATED:components:end -->

## Do's and Don'ts
- Do use theme tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `rounded-lg`) and the Tailwind scales.
- Do change design values only in `globals.css`; this file regenerates from it.
- Don't use hex/rgb/oklch literals, Tailwind palette colors (`zinc-500`), arbitrary values (`w-[123px]`), or inline style literals.
- Don't introduce new fonts, radii, or shadows ad hoc; add a token in `globals.css` first.
"""


def render_design(root: Path, existing: str | None) -> str:
    t = parse_tokens(root)
    comps = component_tokens(root, t)
    try:
        project = json.loads((root / "package.json").read_text()).get("name", "project")
    except (OSError, json.JSONDecodeError):
        project = "project"
    name, desc = f"{project} web", "Visual system for apps/web (shadcn preset b4XwA3eDL6)"
    body = SKELETON.format(name=name)
    if existing:
        fm = re.match(r"---\n(.*?)\n---\n", existing, re.S)
        if fm:
            if m := re.search(r"^name:\s*(.+)$", fm.group(1), re.M):
                name = json.loads(m.group(1)) if m.group(1).startswith('"') else m.group(1).strip()
            if m := re.search(r"^description:\s*(.+)$", fm.group(1), re.M):
                desc = json.loads(m.group(1)) if m.group(1).startswith('"') else m.group(1).strip()
            body = existing[fm.end() :]
        else:
            body = existing
    for key, content in gen_blocks(t, comps).items():
        start, end = f"<!-- GENERATED:{key}:start -->", f"<!-- GENERATED:{key}:end -->"
        if start in body and end in body:
            body = re.sub(
                rf"{re.escape(start)}.*?{re.escape(end)}",
                lambda _: f"{start}\n{content}\n{end}",
                body,
                flags=re.S,
            )
    return (
        render_frontmatter(t, comps, name, desc) + body.lstrip("\n").join(["\n", ""])
        if False
        else render_frontmatter(t, comps, name, desc) + "\n" + body.lstrip("\n")
    )


# ----------------------------------------------------------------------------- hardcoded-value lint

PALETTE = r"(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)"
UTIL = r"(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|shadow|accent|caret)"
RULES = [
    (
        "color-literal",
        re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\("),
        "hardcoded color: use a theme token (bg-primary, text-muted-foreground, …)",
    ),
    (
        "palette-color",
        re.compile(rf"(?<![\w-]){UTIL}-{PALETTE}-\d{{2,3}}\b|(?<![\w-]){UTIL}-(?:black|white)\b"),
        "Tailwind palette color: use a semantic token (destructive, primary, muted, border, …)",
    ),
    (
        "arbitrary-value",
        re.compile(r"(?<![\w-])[a-z][\w-]*-\[(?!var\(--|calc\(var\(--|--spacing)[^\]\s]+\]"),
        "arbitrary value: use the Tailwind scale or a token (add one in globals.css if missing)",
    ),
    (
        "inline-style",
        re.compile(
            r"style=\{\{[^}]*(?:\d+px|#[0-9a-fA-F]{3,8}|rgba?\(|fontSize|fontFamily|color:)"
        ),
        "inline style literal: use classes and tokens",
    ),
    (
        "font-literal",
        re.compile(r"font-\[[\"']|fontFamily\s*:"),
        "hardcoded font: use font-sans / font-heading / font-mono",
    ),
]


def lint_file(path: Path) -> list[str]:
    rel = path.resolve().relative_to(ROOT).as_posix()
    if VENDORED.search("/" + rel):
        return []
    text = path.read_text(errors="replace")
    findings = []
    in_token_block = False
    for n, line in enumerate(text.splitlines(), 1):
        if rel.endswith("globals.css"):  # token definitions are the one place literals belong
            if re.match(r"^\s*(:root|\.dark|@theme)\b", line):
                in_token_block = True
            elif in_token_block and line.startswith("}"):
                in_token_block = False
                continue
            if in_token_block:
                continue
        if "design-allow:" in line or line.lstrip().startswith(("import ", "//", "*", "/*")):
            continue
        for rid, rx, msg in RULES:
            if m := rx.search(line):
                findings.append(f"{rel}:{n}: [{rid}] `{m.group(0)}`: {msg}")
    return findings


def ui_files(root: Path) -> list[Path]:
    seen = []
    for g in UI_GLOBS:
        for p in sorted(root.glob(g)):
            if (
                p.is_file()
                and not VENDORED.search("/" + p.relative_to(root).as_posix())
                and p not in seen
            ):
                seen.append(p)
    return seen


# ----------------------------------------------------------------------------- CLI


def main() -> int:
    args = [a for a in sys.argv[1:]]
    cmd = args[0] if args else "check"
    global ROOT
    if cmd in ("sync", "check") and len(args) > 1:
        ROOT = Path(args[1]).resolve()
    design = ROOT / DESIGN
    if cmd == "sync":
        existing = design.read_text() if design.exists() else None
        new = render_design(ROOT, existing)
        if existing != new:
            design.write_text(new)
            print(
                f"DESIGN.md synced from globals.css ({'created' if existing is None else 'updated'})"
            )
        else:
            print("DESIGN.md already mirrors globals.css")
        return 0
    if cmd == "check":
        problems = []
        if not design.exists():
            problems.append(f"{DESIGN} missing: run `pnpm design:sync`")
        elif design.read_text() != render_design(ROOT, design.read_text()):
            problems.append(
                f"{DESIGN} is out of sync with globals.css: edit globals.css, then `pnpm design:sync`"
            )
        problems += [f for p in ui_files(ROOT) for f in lint_file(p)]
        for p in problems:
            print(p)
        print("design tokens: ok" if not problems else f"design tokens: {len(problems)} problem(s)")
        return 1 if problems else 0
    if cmd == "lint":
        files = [Path(a) for a in args[1:]] or ui_files(ROOT)
        findings = [f for p in files if p.exists() for f in lint_file(p)]
        print("\n".join(findings) or "no hardcoded design values")
        return 1 if findings else 0
    if cmd == "hook":
        try:
            fp = json.load(sys.stdin).get("tool_input", {}).get("file_path", "")
        except json.JSONDecodeError:
            return 0
        if not fp:
            return 0
        p = Path(fp).resolve()
        if not p.exists() or ROOT not in p.parents:
            return 0
        rel = p.relative_to(ROOT).as_posix()
        if rel == CSS.as_posix():
            existing = design.read_text() if design.exists() else None
            new = render_design(ROOT, existing)
            if existing != new:
                design.write_text(new)
                print(
                    json.dumps(
                        {
                            "hookSpecificOutput": {
                                "hookEventName": "PostToolUse",
                                "additionalContext": f"globals.css changed → {DESIGN} regenerated to mirror it. Run `/impeccable document` if the change alters the design's character.",
                            }
                        }
                    )
                )
            return 0
        if rel == DESIGN.as_posix():
            if design.read_text() != render_design(ROOT, design.read_text()):
                print(
                    f"{DESIGN} tokens are generated from globals.css and must mirror it. Revert the token edit, change "
                    f"globals.css instead (then `pnpm design:sync`). Only prose sections are hand-editable.",
                    file=sys.stderr,
                )
                return 2
            return 0
        if re.search(r"\.(tsx|ts|css)$", rel) and (
            rel.startswith(f"{APP}/src/") or rel.startswith("packages/")
        ):
            findings = lint_file(p)
            if findings:
                print(
                    "Hardcoded design values. Use design tokens (see apps/web/DESIGN.md):\n- "
                    + "\n- ".join(findings),
                    file=sys.stderr,
                )
                return 2
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
