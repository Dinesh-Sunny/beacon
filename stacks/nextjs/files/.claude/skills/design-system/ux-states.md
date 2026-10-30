# UX states, flows & conditions checklist

Fill this in during PLANNING (in the plan doc) for every screen or component, and verify each item during implementation.

## States (each needs a design, not just the happy path)
- [ ] Default / idle   - [ ] Hover   - [ ] Focus-visible   - [ ] Active / pressed   - [ ] Disabled (with a reason)
- [ ] Loading: first load (Skeleton), in-place (Spinner), optimistic update
- [ ] Empty: first-run (call to action), no results (clear filters), cleared
- [ ] Error: validation (inline, Field), request failed (retry), permission denied, not found, offline
- [ ] Success: confirmation, toast or inline, next step
- [ ] Partial / degraded: some data failed, stale data, read-only

## Flows
- [ ] Happy path, start to finish   - [ ] Cancel or back at every step   - [ ] Error recovery without data loss
- [ ] First-time vs returning user   - [ ] Permissions or roles   - [ ] Destructive action → AlertDialog confirm (+ undo where possible)
- [ ] Multi-step: progress shown, resumable, validation per step

## Conditions
- [ ] Responsive: 360px → desktop   - [ ] Light + dark   - [ ] Long, short, or missing content   - [ ] Large data (pagination or virtualization)
- [ ] Slow network (loading > 1s)   - [ ] Keyboard-only and screen reader (labels, roles, aria-live for async results)
- [ ] Reduced motion (`prefers-reduced-motion`)   - [ ] Internationalization (long strings, number, currency, and date formats)

## Motion (purposeful, never decorative noise)
- Use motion to explain change: enter/exit, state transitions, feedback. 150–300ms, ease-out; at most one hero effect per view.
- Heavy effects (3D, particles, WebGL backgrounds) only on marketing surfaces, never inside dense app UI.
- Check performance: no layout thrash, and animate transform and opacity only.

## Sourcing order
1. Our shadcn components (`ui/*`) + the /design reference compositions
2. Animated libraries in [libraries.md](libraries.md) (free items only)
3. Build it ourselves with our components + `motion` (also for anything Pro or paid)
