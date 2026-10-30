#!/usr/bin/env python3
"""Port shadcn's /create preview pages (radix base) into apps/web/src/app/(frontend)/design/.

Pages on ui.shadcn.com/create: 01 = block "preview-02" → _preview-02/, 02 = block "preview" → _preview/.
Usage: port-preview.py <shadcn-ui clone> [project root]
Clone: gh repo clone shadcn-ui/ui "$TMPDIR/gh-clones-$CLAUDE_SESSION_ID/ui" -- --depth 1 --filter=blob:none --sparse
       git -C <clone> sparse-checkout set apps/v4/registry/bases/radix/blocks/preview apps/v4/registry/bases/radix/blocks/preview-02
Rewrites registry imports to @/components/ui, converts IconPlaceholder to direct Hugeicons imports,
and lists any remaining website-internal imports that need a manual fix. Source: MIT-licensed shadcn/ui.
"""
import re
import sys
from pathlib import Path

BLOCKS = ("preview", "preview-02")
blocks_root = Path(sys.argv[1]) / "apps/v4/registry/bases/radix/blocks"
root = Path(sys.argv[2] if len(sys.argv) > 2 else ".")
ICON_RE = re.compile(r"<IconPlaceholder\b(.*?)/>", re.S)


PRESET = {"font": "Inter", "heading": "Merriweather", "style": "Vega"}  # preset b4XwA3eDL6


def fix_site_internals(name: str, t: str) -> str:
    """Replace shadcn-website internals with static equivalents for our preset."""
    t = t.replace("cn-font-heading", "font-heading")  # site-only class; our components use font-heading
    t = re.sub(r'import \{ IconPlaceholder \} from "[^"]+"\n', "", t) if "<IconPlaceholder" not in t else t
    if 'const isRounded = !["lyra", "sera"].includes(params.style)' in t:  # chart cards
        t = re.sub(r'import \{ useDesignSystemSearchParams \} from "[^"]+"\n', "", t)
        t = t.replace(
            '  const [params] = useDesignSystemSearchParams()\n  const isRounded = !["lyra", "sera"].includes(params.style)',
            '  const isRounded = true // preset style "vega" uses rounded bars',
        )
    if name in ("style-overview.tsx", "typography-specimen.tsx"):
        t = re.sub(r'import \{ (STYLES|FONTS|useDesignSystemSearchParams) \} from "[^"]+"\n', "", t)
        t = t.replace("  const [params] = useDesignSystemSearchParams()\n", "")
        for var, val in (("currentFont", f'{{ name: "{PRESET["font"]}" }}'),
                         ("currentFontHeading", f'{{ name: "{PRESET["heading"]}" }}'),
                         ("currentStyle", f'{{ title: "{PRESET["style"]}" }}')):
            t = re.sub(rf"  const {var} = React\.useMemo\(.*?\n  \)\n", f"  const {var} = {val}\n", t, flags=re.S)
    # Site styles Item/CardContent via cn-* CSS; our utility classes need these to render identically.
    t = t.replace('<Item variant="muted" className="flex-col items-stretch">', '<Item variant="muted" className="flex-col flex-nowrap items-stretch">')
    if name == "qr-connect.tsx":
        t = t.replace('<CardContent className="flex justify-center pt-6">', '<CardContent className="flex items-center pt-6">')
    # Site CSS (cn-chart) sizes square charts; give them an explicit width so ResponsiveContainer isn't 0x0.
    t = re.sub(r'className="mx-auto aspect-square max-h-\[(\d+px)\]"', r'className="mx-auto aspect-square w-full max-w-[\1]"', t)
    if name == "icon-preview-grid.tsx":
        icons = re.findall(r'hugeicons: "(\w+)"', t)
        body = re.search(r"export function IconPreviewGrid.*", t, re.S).group(0)
        body = re.sub(r"<IconPlaceholder.*?/>", "<HugeiconsIcon icon={icon} strokeWidth={2} />", body, flags=re.S)
        body = body.replace(" style-sera:rounded-none", "")
        t = ('"use client"\n\nimport { HugeiconsIcon } from "@hugeicons/react"\n'
             f'import {{ {", ".join(icons)} }} from "@hugeicons/core-free-icons"\n\n'
             'import { Card, CardContent } from "@/components/ui/card"\n\n'
             f"const PREVIEW_ICONS = [{', '.join(icons)}]\n\n" + body)
    return t

leftovers: dict[str, list[str]] = {}
total = 0
for block in BLOCKS:
  src = blocks_root / block
  dst = root / "apps/web/src/app/(frontend)/design" / f"_{block}"
  dst.mkdir(parents=True, exist_ok=True)
  header = f"// Adapted from shadcn/ui (MIT): apps/v4/registry/bases/radix/blocks/{block}. Regenerate with the design-system skill.\n"
  files = [src / "index.tsx", *sorted((src / "cards").glob("*.tsx"))]
  total += len(files)
  for f in files:
      t = f.read_text()
      t = t.replace("@/registry/bases/radix/ui/", "@/components/ui/")
      t = t.replace(f"@/registry/bases/radix/blocks/{block}/cards/", "./")
      icons: set[str] = set()

      def to_huge(m: re.Match[str]) -> str:
          attrs = m.group(1)
          name = re.search(r'hugeicons="(\w+)"', attrs)
          if not name:
              return m.group(0)
          icons.add(name.group(1))
          rest = re.sub(r'\s*(lucide|tabler|hugeicons|phosphor|remixicon)="[^"]*"', "", attrs).strip()
          return f"<HugeiconsIcon icon={{{name.group(1)}}} strokeWidth={{2}}{(' ' + rest) if rest else ''} />"

      t = ICON_RE.sub(to_huge, t)
      if icons:
          t = re.sub(r'import \{ IconPlaceholder \} from "[^"]+"\n', "", t)
          imports = (
              'import { HugeiconsIcon } from "@hugeicons/react"\n'
              f'import {{ {", ".join(sorted(icons))} }} from "@hugeicons/core-free-icons"\n'
          )
          t = re.sub(r'^((?:"use client"\n\n)?)', lambda m: m.group(1) + imports, t, count=1)
      name = "page-body.tsx" if f.name == "index.tsx" else f.name
      t = fix_site_internals(name, t)
      (dst / name).write_text(header + t)
      bad = re.findall(r'from "(@/app/[^"]+|@/registry/[^"]+|shadcn/icons)"', t)
      if bad or "IconPlaceholder" in t:
          leftovers[f"{block}/{name}"] = sorted(set(bad)) + (["IconPlaceholder"] if "IconPlaceholder" in t else [])

print(f"ported {total} files from {len(BLOCKS)} pages → {root / 'apps/web/src/app/(frontend)/design'}")
for k, v in leftovers.items():
    print(f"  manual fix: {k}: {', '.join(v)}")
