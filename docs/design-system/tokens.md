# Tokens

The named values behind every visual decision. The architecture and most values are copied from Linear's product UI; the structure is theirs, the constraints (Vietnamese text, anxious users, calm as a requirement) are ours. Structure lives in [layout.md](layout.md), motion in [motion.md](motion.md), assembly in [components.md](components.md).

Values here are live in `src/styles/globals.css` and the frontmatter of [design.md](../design.md). The [migration table](#migration-from-the-current-globalscss) records the swap.

## Naming law

- Components use **semantic tokens only**, never primitives. `var(--ink-muted)`, never a raw hex or a `--gray-500`.
- A token is named for its **role**, never its appearance or first use: `--accent`, not `--indigo` or `--sidebar-blue`.
- **`accent` is reserved for the brand color.** Nothing else may be called primary or accent, so "primary" never means both the brand and body text.
- Never borrow a token from another role because it happens to be the right color today. When that role changes, your element changes with it. Add the role instead.
- **Light values now, dark-ready names.** Every name below works unchanged in a dark theme; dark mode is a value swap behind one mechanism (a `.dark` class), never a rename and never "the light palette reversed".

## Color

### Surfaces — a ladder, not shadows

Depth comes from stepping backgrounds and hairlines. Each step has a job; there are no unused steps.

| Token | Light value | Role |
|---|---|---|
| `--canvas` | `#fbfbfb` | The app shell behind everything: rail, header, the space around the content panel |
| `--surface-1` | `#ffffff` | The content panel, cards, inputs, menus — where work happens |
| `--surface-2` | `#f6f6f6` | Hover fill, group-header bands, skeleton blocks |
| `--surface-3` | `#eeeeef` | Pressed fill, selected rows, active nav items |
| `--hairline` | `#e5e5e6` | 1px borders — the first tool for separation, everywhere |
| `--scrim` | `rgb(0 0 0 / 0.4)` | Behind modals and sheets, nothing else |

The signed-in shell is the Linear composition: `--canvas` chrome around a `--surface-1` main panel with a `--hairline` edge and `--radius-container` corner.

### Ink — a four-step text ladder

| Token | Light value | Role |
|---|---|---|
| `--ink` | `#212226` | Headings, row labels, body on reading surfaces |
| `--ink-secondary` | `#4b4f56` | Supporting copy, message bodies in dense UI |
| `--ink-muted` | `#6f737b` | Metadata, captions, group labels, type words — the last step that passes 4.5:1 on `--surface-1` |
| `--ink-faint` | `#8a8f98` | Placeholders and disabled text only; below AA, never body copy |

### Accent — one chromatic color, three states

| Token | Light value | Role |
|---|---|---|
| `--accent` | `#5e6ad2` | Links, the one primary action, active nav text, active toggles |
| `--accent-hover` | `#828fff` | Hover on accent fills and links; never body text on white |
| `--accent-muted` | `rgb(94 106 210 / 0.1)` | The quiet fill behind a selected accent item |
| `--on-accent` | `#ffffff` | Text on accent fills |
| `--focus-ring` | `0 0 0 3px rgb(94 106 210 / 0.3)` | The focus state, everywhere, unaltered |

The accent law, copied from Linear verbatim: the accent appears on links, focus, the primary CTA, and active states — **never as decoration, never a card background, never a section tint**. One accent; a second chromatic accent is a defect.

### Functional colors

| Token | Light value | Role |
|---|---|---|
| `--destructive` | `#c52828` | Delete, and nothing else (dark theme will swap to Linear's `#eb5757`) |
| `--status-progress` | `#deb949` | In-progress dots and chips |
| `--status-positive` | `#4cb782` | Done / offer / published dots and chips |
| `--status-attention` | `#fc7840` | Needs-action dots and chips |

Status colors live **only inside chips and dots, always beside the word** (interviewing, published). Status is never conveyed by color alone, and these hues never color text, fills, or anything outside a chip. Outcomes in prose stay written in words per [copy.md](../copy.md).

## Typography

One variable font. Inter Variable with `font-feature-settings: "cv01", "ss03"` set globally — the single-story `a` and cleaner glyphs are part of the look. Inter has full Vietnamese diacritic coverage; it replaces Be Vietnam Pro. Ship `woff2` only.

- `--font-sans`: `"Inter Variable", Inter, system-ui, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", Menlo, monospace` — code, keyboard keys, and the public handle only

**Weights are the off-standard stops that make the look:** 400 body, **510** UI emphasis, **590** headings. Nothing else. Tracking tightens as size grows; body is 0.

| Role | Size / line / weight / tracking | Used for |
|---|---|---|
| `display` | 32px / 1.3 / 590 / −0.022em | Landing promise only |
| `title-lg` | 24px / 1.3 / 590 / −0.017em | The band title (h1), one per screen |
| `title` | 18px / 1.4 / 510 / −0.012em | Section headings, dialog titles |
| `title-sm` | 15px / 1.5 / 510 / −0.012em | Row labels, card labels, the dock header |
| `body` | 15px / 1.6 / 400 / 0 | Reading text, messages, editors |
| `ui` | 13px / 1.5 / 400 / 0 | Rail items, buttons, meta, filters, chips |
| `ui-label` | 13px / 1.5 / 510 / 0 | Form labels, group labels, emphasized UI |
| `caption` | 12px / 1.5 / 400 / 0 | Tertiary detail, keyboard hints |

Rules that ride along:

- **Vietnamese floor:** line-height never below 1.3 on headings and 1.5 on body — stacked tone marks (ề, ữ, ộ) must not clip. Test every style with "Nguyễn Thị Ngọc Ánh" and "trường đại học".
- Root `html` stays 16px so rem and `--size-touch` (44px) sit on the 4px scale; the `body` type role is 15px on `body`, not by shrinking the root.
- `font-variant-numeric: tabular-nums` on every changing number and every table column: completeness counts, dates, fit scores.
- `text-wrap: balance` on headings, `text-wrap: pretty` on descriptions, neither in long-form text. Reading measure stays 65–75ch.
- `overflow-wrap: break-word` wherever links, emails, or IDs can escape; `white-space: nowrap` on chips and type words.
- Antialiasing set once on the root. Copy stored in natural case; presentation via `text-transform` if ever needed (it is not — sentence case everywhere).
- Smart punctuation in copy: curly quotes, en dash for ranges, em dash for asides, the single ellipsis character.

## Spacing and size

4px base scale: **4, 8, 12, 16, 24, 32, 48**. No values off the scale. The gap between groups is at least twice the gap inside one (8 within, 16+ between) — the layout half of this law is in [layout.md](layout.md).

| Token | Value | Role |
|---|---|---|
| `--size-touch` | 44px | Minimum touch target; 40px acceptable on desktop-only controls, hit areas never overlap |
| `--size-rail` | 16rem | Default rail width (drawer stays this). Desktop rail is user-resizable between `--size-rail-min` and `--size-rail-max`. |
| `--size-rail-min` | 12rem | Narrowest desktop rail |
| `--size-rail-max` | 20rem | Widest desktop rail |
| `--size-dock` | 20rem × max 32rem | Desktop dock panel |
| `--size-page` | 210mm × min 297mm | The A4, non-negotiable |
| `--measure` | 65–75ch | Reading column cap |

## Radius

| Token | Value | Role |
|---|---|---|
| `--radius-tag` | 4px | Tiny chips and tags |
| `--radius-control` | 6px | Buttons, inputs, rail items, menu items |
| `--radius-container` | 12px | Cards, dialogs, menus, the dock, the main content panel |
| `--radius-pill` | 9999px | Status chips, count badges |

No third working radius on one screen. **Concentric rule:** a nested rounded element's radius = outer radius − the inset between them, so corners stay parallel. Documents are the exception to everything: the A4 and letters are sharp black-on-white rectangles (`--surface-1` will not theme them; they keep `#ffffff`/`#000000`), outside app rounding and app theming entirely.

## Elevation and z

Border-first, shadows almost invisible. A static element never has a drop shadow; separation is `--hairline`. Images get a 1px inset outline at 8% black (8% white in dark) so photos never bleed into the surface.

| Level | Treatment | z | Used by |
|---|---|---|---|
| 0 | Flat on its surface | 0 | Content |
| 1 | `--hairline` border | 0 | Cards, inputs, panels, the rail edge |
| 2 | Border + `--shadow-overlay` | 20–30 | Sticky band 20, dock 30 |
| 3 | `--scrim` + `--shadow-overlay` | 40 | Drawer, sheets, dialogs, menus |
| 4 | — | 50 | Skip link |

- `--shadow-overlay`: `0 4px 12px rgb(0 0 0 / 0.1)` — the one shadow, only for genuinely floating layers (menus, dialogs, the dock).
- The z scale is closed: content 0, sticky 20, dock 30, overlays 40, skip link 50. The dock can never beat a dialog.

## Interaction states

Every interactive element has all of these, distinguishable without color alone:

| State | Treatment |
|---|---|
| Hover | Fill steps to `--surface-2` (or `--accent-hover` on accent fills). Behind `@media (hover: hover)` — touch must not stick |
| Pressed | `transform: scale(0.97)` (see [motion.md](motion.md)) and fill to `--surface-3` |
| Selected / active | `--surface-3` fill; nav adds `--accent` text |
| Focus | `--focus-ring`, never removed, never restyled per component |
| Disabled | `opacity: 0.5`, cursor unchanged; paste is never blocked; submit stays enabled until the request starts |

## Iconography

Type is a word, not an icon: CV, Resume, Cover letter, Proof, Apply are written out. `lucide-react` only for wordless controls already understood everywhere — close, menu, chevron, the send arrow. The `···` row trigger stays text. No decorative icons, no icon+word pairs on rows, and every icon-only control carries an `aria-label`.

## Migration from the current globals.css

The implementation checklist. "Renamed" means the old Tailwind alias should move to the new semantic name in the same pass.

| Today in `globals.css` | Becomes | Note |
|---|---|---|
| `--font-sans: "Be Vietnam Pro"…` | `"Inter Variable", Inter, system-ui` | Swap `@fontsource` imports to `@fontsource-variable/inter`; set `font-feature-settings: "cv01", "ss03"` on root |
| `html { font-size: 16px }` | 15px body via `body` type role | UI chrome drops to 13px |
| `--color-background: #ffffff` | `--surface-1: #ffffff`, new `--canvas: #fbfbfb` | Shell gets the canvas/panel split |
| `--color-foreground: #141413` | `--ink: #212226` | |
| `--color-muted: #f5f5f4` | `--surface-2: #f6f6f6` | New `--surface-3: #eeeeef` for pressed/selected |
| `--color-muted-foreground: #5c5c58` | `--ink-muted: #6f737b` | New `--ink-secondary: #4b4f56`, `--ink-faint: #8a8f98` |
| `--color-border: #e4e4e1` | `--hairline: #e5e5e6` | |
| `--color-accent: #1a5e45` (green) | `--accent: #5e6ad2` (indigo) | New `--accent-hover`, `--accent-muted`, `--focus-ring` |
| `--color-accent-foreground` | `--on-accent: #ffffff` | |
| `--color-destructive: #9f1d1d` | `--destructive: #c52828` | |
| `--radius-control: 6px` | unchanged | |
| `--radius-card: 10px` | `--radius-container: 12px` | New `--radius-tag: 4px`, `--radius-pill` |
| `*:focus-visible` outline 2px accent | `--focus-ring` box-shadow, 3px accent at 30% | Keep a transparent outline for forced-colors mode |
| shadcn `shadow-sm` on dock/menus | `--shadow-overlay` | Name it; nothing else may cast |
| — | `--scrim`, z scale variables, status hues, `--size-*` | New |
| `.a4` block | unchanged | Documents stay outside theming |

Weights need the variable font: 510 and 590 do not exist in static Inter files. Until the swap lands, 500/600 are the acceptable stand-ins and the difference is a known gap, not a choice.

## Opal token bridge

Ported Opal / Craft code must be restyled to the tokens above. Never leave `--text-01` or `bg-background-neutral-00` in OpenPath. Our `@theme` block in `src/styles/globals.css` stays the source of truth.

| Opal token / class | OpenPath token |
|---|---|
| `text-01` … `text-05` | `--ink` → `--ink-secondary` → `--ink-muted` → `--ink-faint` |
| `background-neutral-00` / `01` | `--surface-1` |
| `background-neutral-02` / `background-tint-02` | `--surface-2` |
| `background-tint-03` / selected fills | `--surface-3` |
| `border-01` … `border-05` | `--hairline` |
| `status-info-*` | `--accent` / `--accent-muted` |
| `status-success-*` | `--status-positive` |
| `status-warning-*` | `--status-progress` |
| `status-error-*` | `--destructive` |
| `action-danger-*` | `--destructive` |
| `rounded-08` | `--radius-control` |
| larger rounding | `--radius-container` |
| `main-ui-body` / 14px body | `body` 15px / 1.6 |
| `main-ui-muted` / 12–13px | `ui` 13px |
| `secondary-body` | `ui` in `--ink-muted` |
