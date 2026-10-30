# Animated component libraries (free tiers)

Registered in `apps/web/components.json`, the single source the catalog builder reads. Add a registry there + rebuild the catalog = new library available.
Source list: https://animate-ui.com/docs/other-animated-distributions (plus two matching extras).

| Namespace | Library | Best for | Installs to |
| --- | --- | --- | --- |
| `@animate-ui` | Animate UI | Animated versions of shadcn/Radix primitives (buttons, tabs, dialogs, popovers), text effects, backgrounds | `apps/web/src/components/animate-ui/` |
| `@magicui` | Magic UI | Marketing and landing effects: marquee, bento grid, number ticker, shimmer and rainbow buttons, globe, particles | `apps/web/src/components/ui/` |
| `@aceternity` | Aceternity UI | Hero sections, 3D cards, spotlight, beams, parallax, full landing blocks | `apps/web/src/components/ui/` |
| `@react-bits` | React Bits | Text animations, backgrounds, cursor and scroll effects. **Use `-TS-TW` variants only** | `apps/web/src/components/` |
| `@eldoraui` | Eldora UI | Animated sections and landing components | `apps/web/src/components/ui/` |
| `@paceui` | Pace UI | Small set of motion-first components | `apps/web/src/components/ui/` |
| `@motion-primitives` | Motion Primitives | Low-level motion building blocks (text effects, transitions, morphing dialogs) | `apps/web/src/components/` |
| `@hugeicons-animated` | Hugeicons Animated | Animated versions of our icon set, for micro-interactions | `apps/web/src/components/` |

Reference only (no shadcn registry, don't install): **Hover** (hover.dev, copy patterns), **Motion Examples**
(examples.motion.dev, study techniques), and **Headless UI** (overlaps Radix, which we already use; don't add).

## Find components
Start with the local catalog: [catalog/README.md](catalog/README.md) (generated, categorized, refreshed weekly).
Live search, only when the catalog has nothing suitable or might be stale:
```bash
# from apps/web
pnpm dlx shadcn@latest search @animate-ui @magicui @aceternity @react-bits @eldoraui @paceui @motion-primitives -q "<what you need>"
pnpm dlx shadcn@latest view @magicui/<name>          # read the source before choosing
```

Known upstream quirk: the shadcn MCP search shows `Add command: [object Promise]`; ignore it and use `pnpm dlx shadcn@latest add <ns>/<name>`.

## Install safely
1. `pnpm dlx shadcn@latest add <ns>/<name> --dry-run`: check the target paths and dependencies.
2. **Never `--overwrite`.** If a target collides with an existing file (our shadcn `ui/*`), view the source and place it under `apps/web/src/components/<library>/` by hand.
3. Free items only. If an item is gated or marked Pro, don't use it: rebuild the idea with our components + `motion`.
4. Adapt after install: theme tokens instead of hardcoded colors, Hugeicons instead of other icon sets where icons are visible, our fonts.
5. Respect reduced motion. When the first `motion` component lands, wrap the app in `<MotionConfig reducedMotion="user">`.
