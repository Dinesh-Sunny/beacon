# Reference compositions

Both pages of ui.shadcn.com/create, shown together on the /design page (page 02 first, then page 01).
- Page 01: `apps/web/src/app/(frontend)/design/_preview-02/` (finance, music, smart-home flows)
- Page 02: `apps/web/src/app/(frontend)/design/_preview/` (dev tools, team, analytics)

Pick the closest card, copy its structure, and swap in real data.

## Page 01 (preview-02 folder)

| Need | Reference card | Components |
| --- | --- | --- |
| App sidebar navigation | `sidebar-nav` | sidebar |
| Breadcrumb + action list | `payments` | breadcrumb, item, dropdown-menu |
| Settings form with toggles | `preferences`, `notification-settings` | field, select, switch, checkbox |
| Slider-driven form | `payout-threshold` | field, select, slider, textarea |
| Money transfer / payment method | `transfer-funds`, `receiving-method` | field, input-group, select, radio-group, item |
| Sign-in / account access | `account-access`, `new-milestone` | field, input, item |
| Goals with progress | `savings-targets`, `savings-progress` | item, progress, chart |
| Balance / summary | `claimable-balance`, `card-overview` | item, badge, separator, chart |
| Transactions table | `recent-transactions` | table, dropdown-menu |
| Calendar / schedule list | `upcoming-payments` | calendar, item, badge |
| Stock / dividend charts | `stock-performance`, `dividend-income`, `contribution-history`, `power-usage` | chart, combobox, progress |
| Filter toolbar / catalog | `catalog-toolbar`, `release-catalog` | input-group, toggle-group, item |
| FAQ / help | `faq` | accordion, tabs |
| Device controls | `kitchen-island`, `roller-shades`, `front-door` | slider, switch, toggle-group |
| Media cards | `album-card`, `cover-art` | item, badge |
| Social / links form | `social-links` | field, input-group |
| Empty states | `empty-connect-bank`, `empty-distribute-track`, `empty-explore-catalog` | empty |
| Loading / syncing | `loading-card`, `syncing-state` | skeleton, spinner, empty |
| QR / device pairing | `qr-connect` | react-qr-code |

## Page 02 (preview folder)

| Need | Reference card | Components |
| --- | --- | --- |
| Form (multi-field) | `report-bug`, `feedback-form`, `shipping-address`, `github-profile` | field, input, select / native-select, textarea, checkbox |
| Invite / add people | `invite-team` | field, input, input-group, select, separator |
| Scheduling / choices | `book-appointment` | field, toggle-group, alert |
| Settings list with actions | `environment-variables`, `codespaces-card` | button, input-group, tabs, dropdown-menu, item, empty |
| Confirm / modal flow | `activate-agent-dialog`, `typography-specimen` (dialog) | dialog, alert, item, badge |
| Assign / pick a person | `assign-issue` | combobox, avatar, tooltip |
| People list | `contributors`, `no-team-members` | avatar, badge, empty |
| Empty / zero state | `no-team-members`, `anomaly-alert`, `file-upload`, `not-found` | empty, button, input-group, kbd |
| Invoice / data table | `invoice` | table, badge |
| KPI + chart | `analytics-card`, `visitors`, `sleep-report` | chart, badge |
| Bar / pie charts | `bar-chart-card`, `pie-chart-card` | chart, progress |
| Usage / quotas | `usage-card`, `observability-card` | item, badge |
| Keyboard shortcuts | `shortcuts` | item, kbd |
| Loading state | `skeleton-loading` | skeleton |
| Control gallery | `ui-elements` | alert-dialog, button-group, radio-group, slider, switch, checkbox, dropdown-menu |
| Theme tokens / type scale | `style-overview`, `typography-specimen` | tokens, font-heading |

## Installed components (39 + toggle)
accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, button-group, calendar, card, chart, checkbox, combobox, dialog,
dropdown-menu, empty, field, input, input-group, item, kbd, label, native-select, popover, progress, radio-group, select, separator,
sheet, sidebar (+ hooks/use-mobile), skeleton, slider, spinner, switch, table, tabs, textarea, toggle (via toggle-group), toggle-group, tooltip

## Local patches to vendored components (re-apply after `--overwrite`)
- `apps/web/src/components/ui/sheet.tsx`: the close button adds `pointer-coarse:size-11` (44px touch target; upstream is 32px).
- `apps/web/src/components/ui/spinner.tsx`: props typed `Omit<React.ComponentProps<"svg">, "strokeWidth">`, because `HugeiconsIcon` accepts only a numeric `strokeWidth` (upstream type bug).

## App wiring
- `TooltipProvider` wraps the app in `apps/web/src/app/(frontend)/layout.tsx` (needed by every Tooltip).
- Biome ignores `apps/web/src/components/ui/`, `apps/web/src/hooks/use-mobile.ts`, and the `_preview*` reference folders (vendored shadcn code kept as-is).
