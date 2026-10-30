#!/usr/bin/env python3
"""Build the local, categorized catalog of free animated UI components.

Reads the registries from apps/web/components.json (single source of truth), fetches each
registry's index (<base>/registry.json), drops demos/examples and duplicate variants, classifies
every item into one app-oriented taxonomy, and writes:

  .claude/skills/design-system/catalog/README.md        index: categories × libraries, counts
  .claude/skills/design-system/catalog/<category>.md    one table per category (name, library, what it does, add command)
  .claude/skills/design-system/catalog/catalog.json     machine-readable, all items

Usage: build-catalog.py [project root] [--check]
  --check   exit 1 if the catalog on disk is out of date (no writes). Stdlib only.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(next((a for a in sys.argv[1:] if not a.startswith("--")), "."))
CHECK = "--check" in sys.argv
OUT = ROOT / ".claude/skills/design-system/catalog"
COMPONENTS_JSON = ROOT / "apps/web/components.json"

# Unified taxonomy, in display order: (slug, title, keywords matched against name + description).
CATEGORIES: list[tuple[str, str, tuple[str, ...]]] = [
    (
        "sections",
        "Page sections (hero, features, pricing, testimonials...)",
        (
            "hero",
            "feature",
            "pricing",
            "testimonial",
            "cta",
            "call-to-action",
            "footer",
            "header",
            "navbar-block",
            "logo-cloud",
            "logos",
            "blog",
            "team",
            "faq-section",
            "contact",
            "newsletter",
            "stats-section",
            "landing",
            "section",
            "login",
            "signup",
            "sign-in",
            "sign-up",
            "auth",
        ),
    ),
    (
        "buttons",
        "Buttons & actions",
        ("button", "btn", "toggle", "switch", "copy", "like", "ripple", "magnetic"),
    ),
    (
        "text",
        "Text & typography effects",
        (
            "text",
            "typing",
            "typewriter",
            "word",
            "letter",
            "char",
            "headline",
            "shiny",
            "gradient-text",
            "scramble",
            "decrypt",
            "blur-in",
            "split",
            "counter-text",
            "rotating",
            "highlighter",
            "morphing-text",
            "sparkles-text",
        ),
    ),
    (
        "backgrounds",
        "Backgrounds & ambient effects",
        (
            "background",
            "bg",
            "particles",
            "beams",
            "grid",
            "dots",
            "aurora",
            "waves",
            "noise",
            "gradient",
            "stars",
            "meteors",
            "ripple-bg",
            "lightning",
            "galaxy",
            "silk",
            "threads",
            "orb",
            "hyperspeed",
            "squares",
            "lines",
            "boxes",
            "vortex", "sparkle", "lamp", "laser", "rings", "snow", "burst", "glass", "pixel", "prism", "color-bends", "ascii",
            "spotlight",
            "glow",
            "shader",
            "plasma",
            "iridescence",
            "liquid",
        ),
    ),
    (
        "cards",
        "Cards & surfaces",
        (
            "card",
            "glare",
            "tilt",
            "3d-card",
            "bento",
            "pin",
            "focus-cards",
            "wobble",
            "panel",
            "tile",
        ),
    ),
    (
        "navigation",
        "Navigation & menus",
        (
            "nav",
            "navbar",
            "dock",
            "menu",
            "tabs",
            "tab",
            "sidebar",
            "breadcrumb",
            "pagination",
            "stepper",
            "pill",
            "segmented",
            "command",
            "toolbar",
        ),
    ),
    (
        "overlays",
        "Overlays (dialogs, popovers, tooltips, sheets)",
        (
            "dialog",
            "modal",
            "popover",
            "tooltip",
            "sheet",
            "drawer",
            "dropdown",
            "hover-card",
            "context-menu",
            "alert-dialog",
            "toast",
            "notification",
            "sonner",
        ),
    ),
    (
        "forms",
        "Forms & inputs",
        (
            "input",
            "form",
            "field",
            "select",
            "checkbox",
            "radio",
            "slider",
            "otp",
            "textarea",
            "search",
            "file-upload",
            "upload",
            "date",
            "picker",
            "combobox",
            "password",
            "rating",
        ),
    ),
    (
        "data",
        "Data display (numbers, charts, lists, timelines)",
        (
            "number",
            "ticker",
            "counter",
            "chart",
            "table",
            "list",
            "timeline",
            "stat",
            "progress",
            "meter",
            "gauge",
            "calendar",
            "accordion",
            "collapsible",
            "tree",
            "kbd",
            "badge",
            "avatar",
            "terminal", "comments", "integrations", "label", "management",
            "code",
        ),
    ),
    (
        "carousels",
        "Carousels, marquees & scroll",
        (
            "marquee",
            "carousel",
            "slider-gallery",
            "gallery",
            "scroll",
            "parallax",
            "sticky",
            "infinite",
            "loop",
            "velocity",
            "stack",
            "deck",
            "swipe",
            "masonry",
        ),
    ),
    (
        "media",
        "Media, 3D & visuals",
        (
            "image",
            "video",
            "globe",
            "3d",
            "model",
            "lens",
            "zoom",
            "map",
            "photo",
            "icon-cloud",
            "orbit",
            "sphere",
            "cube", "browser", "ipad", "macbook", "compare", "cover", "link-preview", "keyboard", "svg-mask", "notch",
            "camera",
            "mockup",
            "iphone",
            "safari",
            "device",
        ),
    ),
    (
        "feedback",
        "Loaders & feedback",
        ("loader", "loading", "spinner", "skeleton", "pulse", "confetti", "success"),
    ),
    (
        "interactions",
        "Cursor, hover & motion interactions",
        (
            "cursor",
            "pointer",
            "hover",
            "magnet",
            "follow",
            "trail",
            "drag",
            "click",
            "splash",
            "reveal",
            "fade",
            "animate", "beam", "border", "tracing", "moving", "scales", "gemini",
            "motion",
            "transition",
            "morph",
            "flip",
            "blur",
            "spring",
            "in-view",
        ),
    ),
    ("icons", "Animated icons", ()),
    (
        "primitives",
        "Primitives, hooks & utilities",
        ("primitive", "hook", "use-", "slot", "lib", "util", "provider"),
    ),
    ("other", "Other", ()),
]
TITLES = {slug: title for slug, title, _ in CATEGORIES}
GENERIC = {"animate", "motion", "fade", "blur", "transition", "spring", "reveal", "lines", "lib", "section"}


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "__NAME__-design-catalog/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 - fixed registry URLs from components.json
        return json.loads(r.read().decode())


def index_url(template: str) -> str:
    return template.replace("{name}", "registry")


def tokens(item: dict) -> str:
    return f"{item.get('name', '')} {item.get('title', '')} {item.get('description', '')}".lower()


def classify(ns: str, item: dict) -> str:
    name = item["name"].lower()
    cats = [c.lower() for c in item.get("categories") or []]
    if ns == "@hugeicons-animated" or name.startswith("icons-"):
        return "icons"
    if item.get("type") in ("registry:hook", "registry:lib", "registry:style") or name.startswith(
        ("hooks-", "primitives-")
    ):
        return "primitives"
    if item.get("type") == "registry:block" or any(
        c in ("cta", "features", "footer", "header", "logo-cloud", "pricing", "testimonials")
        for c in cats
    ):
        if not re.search(r"background|bg-|text", name):
            return "sections"
    # 1) The component NAME decides first: most specific (longest) keyword wins, generic motion words ignored.
    words_in = lambda text, w: re.search(rf"(?<![a-z]){re.escape(w)}", text) is not None  # noqa: E731
    # CamelCase (React Bits) → kebab-case so "ColorBends" matches "color-bends"
    name_hay = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", item["name"]).lower().replace("_", "-")
    m = re.match(r"components-(?:radix-|base-|headless-|community-)?([a-z]+)-", name)
    if m:  # Animate UI encodes its group: components-<group>-<name>
        name_hay = f"{m.group(1)} {name_hay}"
    best = ("other", 0)
    for slug, _, words in CATEGORIES:
        for w in words:
            if w not in GENERIC and words_in(name_hay, w) and len(w) > best[1]:
                best = (slug, len(w))
    if best[0] != "other":
        return best[0]
    # 2) Fall back to the description, in category order.
    hay = tokens(item)
    for slug, _, words in CATEGORIES:
        if words and any(words_in(hay, w) for w in words):
            return slug
    return "other"


def keep(ns: str, item: dict) -> bool:
    name, typ = item.get("name", ""), item.get("type", "")
    if (
        typ in ("registry:example", "registry:style")
        or name.startswith(("demo-", "example-"))
        or name.endswith("-demo")
    ):
        return False
    if ns == "@react-bits":
        return name.endswith("-TS-TW")  # one variant per component: TypeScript + Tailwind
    return True


def display_name(ns: str, name: str) -> str:
    if ns == "@react-bits":
        return name.removesuffix("-TS-TW")
    return name


def one_line(text: str, limit: int = 110) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip()).replace("|", "/")
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def main() -> int:
    registries: dict[str, str] = json.loads(COMPONENTS_JSON.read_text()).get("registries", {})
    items: list[dict] = []
    errors: list[str] = []
    for ns, template in sorted(registries.items()):
        try:
            data = fetch(index_url(template))
        except Exception as e:  # noqa: BLE001 - report and continue with other registries
            errors.append(f"{ns}: {e}")
            continue
        for it in data.get("items", []):
            if not keep(ns, it):
                continue
            items.append(
                {
                    "name": display_name(ns, it["name"]),
                    "registry": ns,
                    "item": it["name"],
                    "type": it.get("type", "").removeprefix("registry:"),
                    "category": classify(ns, it),
                    "description": one_line(it.get("description") or it.get("title") or ""),
                    "add": f"pnpm dlx shadcn@latest add {ns}/{it['name']}",
                }
            )
    items.sort(key=lambda x: (x["category"], x["registry"], x["name"].lower()))

    files: dict[Path, str] = {
        OUT / "catalog.json": json.dumps({"registries": registries, "items": items}, indent=1)
        + "\n"
    }
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        by_cat[it["category"]].append(it)
    libs = sorted(registries)
    head = (
        "| Category | "
        + " | ".join(l.lstrip("@") for l in libs)
        + " | Total |\n|"
        + " --- |" * (len(libs) + 2)
        + "\n"
    )
    rows = []
    for slug, title, _ in CATEGORIES:
        group = by_cat.get(slug, [])
        if not group:
            continue
        c = Counter(i["registry"] for i in group)
        rows.append(
            f"| [{title}]({slug}.md) | "
            + " | ".join(str(c.get(l, "")) for l in libs)
            + f" | {len(group)} |"
        )
        lines = [
            f"# {title}",
            "",
            f"<!-- GENERATED by build-catalog.py. Do not edit. {len(group)} items. -->",
            "",
            "Free items only. Before installing: `--dry-run`, never `--overwrite` (see ../libraries.md).",
            "",
        ]
        if slug == "icons":
            for ns in libs:
                names = [i["name"] for i in group if i["registry"] == ns]
                if names:
                    lines += [f"## {ns} ({len(names)})", "", ", ".join(f"`{n}`" for n in names), ""]
        else:
            lines += ["| Component | Library | Type | What it does |", "| --- | --- | --- | --- |"]
            lines += [
                f"| `{i['item']}` | {i['registry']} | {i['type']} | {i['description']} |"
                for i in group
            ]
        files[OUT / f"{slug}.md"] = "\n".join(lines).rstrip() + "\n"
    readme = [
        "# Animated UI catalog",
        "",
        f"<!-- GENERATED by scripts/build-catalog.py from apps/web/components.json registries. Do not edit. {len(items)} items. -->",
        "",
        "Local, categorized index of the FREE components in our registered animated libraries, so designs can be planned",
        "without live registry calls. Open the category you need, pick candidates, then `shadcn view <ns>/<item>` before adding.",
        "Refresh: `python3 .claude/skills/design-system/scripts/build-catalog.py .` (weekly CI also opens a PR when it changes).",
        "",
        head + "\n".join(rows),
        "",
        "Demos and examples are excluded; React Bits lists only its TypeScript + Tailwind variant.",
    ]
    if errors:
        readme += ["", "Fetch errors at last build:", *[f"- {e}" for e in errors]]
    files[OUT / "README.md"] = "\n".join(readme) + "\n"

    stale = sorted(p for p in OUT.glob("*") if p.is_file() and p not in files)
    drift = [p for p, c in files.items() if not p.exists() or p.read_text() != c] + stale
    if CHECK:
        print(
            "catalog up to date"
            if not drift
            else "catalog out of date: " + ", ".join(p.name for p in drift)
        )
        return 1 if drift else 0
    OUT.mkdir(parents=True, exist_ok=True)
    for p in stale:
        p.unlink()
    for p, c in files.items():
        p.write_text(c)
    counts = Counter(i["category"] for i in items)
    print(
        f"catalog: {len(items)} items · "
        + ", ".join(f"{k} {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1]))
    )
    if errors:
        print("errors:", *errors, sep="\n  ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
