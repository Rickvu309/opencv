---
version: alpha
name: OpenPath
description: Monochrome light product UI. Conversation-first, scarce color.
colors:
  primary: "oklch(0.2 0 0)"
  on-primary: "oklch(0.99 0 0)"
  secondary: "oklch(0.965 0 0)"
  tertiary: "oklch(0.45 0.1 55)"
  neutral: "oklch(0.98 0 0)"
  page: "oklch(0.98 0 0)"
  canvas: "oklch(0.958 0 0)"
  panel: "oklch(1 0 0)"
  ink: "oklch(0.16 0 0)"
  fill: "oklch(0.965 0 0)"
  muted: "oklch(0.505 0 0)"
  hairline: "oklch(0.916 0 0)"
  ring: "oklch(0.6 0 0)"
  success: "oklch(0.58 0.13 155)"
  warning: "oklch(0.68 0.14 70)"
  danger: "oklch(0.575 0.19 27)"
  info: "oklch(0.55 0.15 255)"
  chart-ink: "oklch(0.24 0 0)"
  chart-haze: "oklch(0.86 0 0)"
  desk: "oklch(0.958 0 0)"
  sheet: "oklch(1 0 0)"
  warm: "oklch(0.45 0.1 55)"
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 3.75rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.032em
  display-next:
    fontFamily: Be Vietnam Pro
    fontSize: 1.5rem
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.025em
  headline:
    fontFamily: Be Vietnam Pro
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.025em
  title:
    fontFamily: Be Vietnam Pro
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.025em
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  chat:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: Be Vietnam Pro
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
  metric:
    fontFamily: Be Vietnam Pro
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.025em
  rail:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  "2xl": 24px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  "2xl": 32px
  "3xl": 40px
  "4xl": 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    height: 32px
    padding: 10px
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "oklch(0.2 0 0 / 0.8)"
    textColor: "{colors.on-primary}"
  button-outline:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: 32px
    padding: 10px
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: 32px
    padding: 10px
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.2xl}"
    height: 28px
    padding: 12px
  chip-idle:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.muted}"
    rounded: "{rounded.2xl}"
    height: 28px
    padding: 12px
  user-bubble:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
  desk:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink}"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
  rail:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  discover-canvas:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
  new-cv:
    backgroundColor: "{colors.warm}"
    textColor: "{colors.on-primary}"
  hairline-rule:
    backgroundColor: "{colors.hairline}"
  focus-ring:
    backgroundColor: "{colors.ring}"
  status-success:
    textColor: "{colors.success}"
  status-warning:
    textColor: "{colors.warning}"
  status-danger:
    textColor: "{colors.danger}"
  status-info:
    textColor: "{colors.info}"
  chart-attained:
    backgroundColor: "{colors.chart-ink}"
    textColor: "{colors.on-primary}"
  chart-rest:
    backgroundColor: "{colors.chart-haze}"
    textColor: "{colors.ink}"
---

## Overview

A daylight desk. White panels on a gray canvas, near-black ink, 1px hairlines. Color marks status, never decoration. Chat is the product. Other screens are artifacts of the conversation.

The brand is a calm older mentor: grounded, honest, never hype. The person arrives in a short, anxious session. Restraint is functional. References for product chrome: Linear's product app, OpenAI's product chrome, Stripe dashboards. Do not copy Linear's dark marketing site or lavender accent.

Two registers share tokens and split chrome:

- **Discover** (`/`, auth, onboarding): no rail, dock, or command palette. Display type and one first-load Stagger are allowed.
- **Product**: inset frame, rail, dock. Fixed rem. No display type. No Stagger on load.

Tokens in this file are normative. They are implemented as Tailwind classes in `src/styles/globals.css`. A color, easing, duration, or radius that is not here fails review. Audience lives in `PRODUCT.md`. The codebase map is `CONTEXT.md`.

## Colors

The palette is high-contrast neutrals and one near-black primary. Semantic color is a 6px dot, a status word, or one icon. No wash, no colored card, no left stripe.

- **Primary (`primary`):** Near-black fill for the single most important action. Text on it is `on-primary` (`text-primary-foreground` in CSS).
- **Ink (`ink`):** Headlines, values, and body. Never lighten it for body copy.
- **Page (`page` / `neutral`):** Content frame and Discover canvas.
- **Canvas (`canvas`):** The rail. Recedes.
- **Panel (`panel`):** White sheets, menus, posters. Comes forward.
- **Fill (`fill` / `secondary`):** Idle chips, tracks, user bubbles.
- **Muted (`muted`):** Labels and meta only. Never the only text on a surface.
- **Hairline (`hairline`):** Every edge and divider, 1px.
- **Ring (`ring`):** Focus only.
- **Warm (`warm` / `tertiary`):** One accent, only on **New** and the unmade CV on My Paper.
- **Desk (`desk`) and Sheet (`sheet`):** The room versus the page you send. Documents stay black on white in every theme.
- **Success, warning, danger, info:** Marks, not fills. Charts use `chart-ink` for the attained value and `chart-haze` for the rest.

One filled primary per view. An active chip or tab may invert; that is state. Ship light. No theme toggle. `.dark` exists so a forced dark scheme stays readable.

## Typography

**Be Vietnam Pro** only. Size and weight make hierarchy. No second family. No `clamp()` in product. No `font-bold`: headings are semibold, inline emphasis is medium.

- **Display:** Discover headline only (48 to 60px, leading 1.2). Vietnamese tone marks need that leading.
- **Display next:** Line under the Discover headline (20 to 24px, medium).
- **Headline:** Product page title, 20px semibold.
- **Title:** Panel headings, 16px semibold.
- **Body:** Product UI, tables, forms, 14px.
- **Chat:** Coach replies, 15px, leading 1.75, measure at most 75ch.
- **Label:** Meta and table headers, 12px muted. Not instructions.
- **Metric:** Computed numbers, 24px semibold, tabular.
- **Rail:** Nav rows, 13px.

Tighten tracking as type gets larger (`-0.032em` from 40px up, `-0.025em` below). Do not go tighter than `-0.04em`. Body, buttons, and labels keep default tracking. Inline `font-mono` is `0.9em` and only for fragments (paths, keys). Inputs are 16px on mobile and 14px from `md`, so iOS does not zoom.

UI copy is English, sentence case, verb-first. The Coach has no given name. Placeholders show an example, not a label.

## Layout

Product pages are a fixed-max-width column (`max-w-6xl`) with `px-5 py-8 sm:px-8`. Discover is narrower (`max-w-3xl`) and aligned to the top. An 4px spacing scale (`xs` through `4xl`) keeps rhythm.

Group with space. Hairlines live only inside a panel. The gap between groups is at least twice the gap inside a group. A heading and its supporting line take the inner gap. Vertical padding around text is slightly tighter than horizontal (`px-5 py-4`, not `p-5`). List rows are `px-4 py-3` with `divide-y`.

- Rail rows: 28px, 40px on touch.
- Sections: `mt-10` apart. A heading sits `mt-4` above its content.
- Dock gutter: 48px (`mb-12`). Include the safe area. Do not add page padding to clear the dock.
- Rows wrap. Primary actions stay in flow or in the shell.
- Sticky chrome uses `border-b` or `border-t` so it separates from scrolling content.

Meet WCAG 2.1 AA: 4.5:1 body, keyboard, 40px chrome / 44px primary targets, `lang="en"`, unclipped diacritics. Focus uses `:focus-visible` and `ring-3 ring-ring/50`. The skip link is the first tab stop. Status always has a non-color cue.

## Elevation & Depth

Depth comes from three tonal layers, not glass and not a fourth surface.

- **Canvas** (`canvas`): rail. Recedes. No border.
- **Frame** (`page`): inset sheet. `m-2 ml-0 rounded-xl shadow-sm ring-1 ring-border`. Height-capped (`h-[calc(100svh-3.5rem)]`, `h-svh` on mobile) and scrolls inside. Full-height views use `h-full`, not nested `100svh`.
- **Panel** (`panel`): content and menus.

The active nav item lifts to `panel` with a hairline, like a tab pulled forward. Hover on the rail is a slightly darker canvas.

Shadows are scarce. The frame may use `shadow-sm` with a ring. Menus use `shadow-md` and `ring-1 ring-foreground/10`. The dock uses `shadow-lg` because it floats. If a card needs a shadow to read as a card, it should have been a panel. Overlay dim is `bg-black/10`.

Never pair `border` with a drop shadow. Shadowed surfaces use `ring-1 ring-border`. A hairline with no shadow stays `border-border`. Overlays sit at `z-50` through portals. `z-[999]` fails review.

## Shapes

Soft rectangles, not pills, not sharp engineering.

- **8px (`md`):** inner controls.
- **12px (`lg`):** buttons, inputs, menus.
- **16px (`xl`):** frame, dock, large panels.
- **24px (`2xl`):** user bubbles and idle chips only.

A filled primary is never a pill. Nested radii stay concentric (outer = inner + padding). Lucide icons are 16px, outline at rest, filled when they mark the active state. Sit inline icons on the first line of text (`items-start` plus `h-lh` on wrapping rows).

## Components

Primitives live in `src/components/ui` (shadcn/ui, Radix). Compose them. Do not restyle a primitive in place. Every control has default, hover, focus-visible, active, and disabled.

### Buttons

32px tall, 12px radius. Discover primary is 44px. One filled primary per view. Ghost for in-panel edit. Destructive is tinted danger text, never a red fill. Disabled is 50% opacity. Show a spinner with the original label only while the request is in flight. Press uses a 1px downward translate. Color on hover is instant.

### Chips

Active inverts to primary. Idle is a hairline on a white panel, muted text. Rail counts are 11px numerals. No badge pills.

### Panels and lists

One bordered container, split by hairlines. Do not nest a panel inside a panel. Table headers are 12px muted on a light fill. Use `Card` only for objects the person can pick up (the Coach's CV thumbnail).

### Inputs

32px, transparent fill, hairline. Focus adds the ring. Errors use `aria-invalid` and text under the field. Keep the dialog mounted and drive it with `open` / `onOpenChange`.

### Navigation

Quiet Linear rail. Coach is home, with the box mark, no section label. Feature rows: **Paper**, **Pitch**, **Search**, **Application**. **Profile** lives in Settings. **Chats** lists stored threads. **New chat** lives in the header. **Help** (`?`) sits bottom-left. ⌘K is keyboard-only. No Search button in the rail. The rail resizes 208 to 400px by drag, hides fully (`offcanvas`), and does not animate on ⌘B.

### Discover

One column, one promise, two doors. No chrome, demo, pillars, or metrics. `hero-enter` Stagger runs once.

### Mark

One SVG (`src/components/brand/coach-box.tsx`). Outline at rest, filled when Coach is active. Four poses: Sit, Listen, Think (same as Sit), Done. Float only on the empty-kit greeting. Keep it off billing, help, print, and toasts.

### Coach

`/coach` and the dock are two layouts of one thread. Replies are unbubbled 15px prose. User turns are a muted 24px-radius bubble. Composer is a textarea, a `+`, and send. No model picker. The dock is a strip in the bottom gutter (in flow with help below `md`), at most 24rem, scale-in from 0.93. Coach edits go through the same registry: toast, Undo, then a continuity wash on the changed field.

### Feature screens

Screen nouns and routes are in `CONTEXT.md`. Layout only:

- **My Profile:** 20rem index and an inspector. Empty section is the form. Sticky **Cancel** / **Save**. Draft until save.
- **My Paper:** One room, Drive then Docs. Desk vs sheet. Warm ink only on **New** and the unmade CV. Sheet-edge stack: name, type word, updated. Open at `/paper?id=`. Completeness on the open CV, never on a row. Proof is a space. **Arrange** then **Publish**.
- **My Pitch:** Bio and intro in one panel. Interview answers as a list.
- **My Search:** One field, then a ranked list. Fit is evidence, never a badge.
- **My Application:** A board. Status is a verb announced through the store.

## Do's and Don'ts

- Do use hairlines, ink, one filled primary, and a visible next step.
- Do treat `/coach` and the dock as two views of one thread.
- Do subdivide a panel before you reach for a card grid.
- Do write sentence-case English and leave room for wrapping.
- Do show computed numbers, and 0% when there is no evidence.
- Do keep dialogs mounted, hover color instant, and icons on the first line of wrapping text.
- Do use a ring on a shadowed surface.
- Do name motion from the vocabulary below and take duration from those four tokens.
- Don't fill a surface with semantic color, add a left stripe, use gradient text, or put glass on a card.
- Don't nest cards, add a fourth surface, add a theme toggle, or write `transition: all`.
- Don't use `font-bold`, `transition-colors` on hover, or `border` plus a drop shadow.
- Don't use `z-[999]`, raw hex, muted ink for body, or a duration other than 120 / 200 / 300 / 500.
- Don't mount a dialog with `{open && …}` or `items-center` a wrapping row.
- Don't invent a fit number or pad a page to clear the dock.
- Don't ship confetti, badges, personality-test astrology, hero-metric templates, or Coach as a support widget.

## Motion

Motion orients, gives feedback, or shows a relationship. Frequency decides whether it runs. Keyboard actions (⌘K, ⌘B, Enter) have no Enter / Exit. Use CSS transitions so UI can be interrupted. Keyframes live only in named recipes in `globals.css`. Exit is faster than Enter. Product UI stays at or under 300ms. A rare Reveal may use 500ms. Scale in starts at 0.93, never `scale(0)`. Gate hover motion with `@media (hover: hover) and (pointer: fine)`. Animate translate, scale, rotate, and opacity. Layout animation belongs only in accordion / collapse.

Color on hover is instant. Press and state color may use 120ms.

| Frequency | Decision |
|---|---|
| 100+/day | Instant |
| Tens/day | Instant hover color, or 120ms fade |
| Occasional | 200 to 300ms enter / exit, origin-aware |
| Rare / first-time | Stagger, 500ms reveal, box float |

| Token | Value | Use |
|---|---|---|
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Enter |
| `--ease-exit` | `cubic-bezier(0.32, 0, 0.67, 0)` | Exit, collapse |
| `--ease-snap` | `cubic-bezier(0.2, 0, 0, 1)` | Press, crossfade |
| `--duration-press` | 120ms | Press and state color |
| `--duration-state` | 200ms | Crossfade, state |
| `--duration-surface` | 300ms | Surface enter / exit |
| `--duration-reveal` | 500ms | Reveal, one blink |

`--ease-*` tokens create utilities. `--duration-*` tokens do not. Write `duration-[var(--duration-surface)]`. A fourth curve or any other millisecond value fails review.

Named motion: Enter / Exit on dock, sheet, menu, toast, sidebar. Scale in on the dock from 0.93. Origin-aware on the dock (`origin-bottom-right`) and popovers. Press on `Button` only. Stagger on Discover once, never on product load. Accordion keeps the inner child's size while the clip closes. Crossfade on thread and dock mark, with 2 to 4px blur. Reveal on bar grow. Continuity wash on Coach edits. Drag on the rail. Float on the empty-kit mark only. Loop on spinner and `ThinkingOrb`. Shake only on field errors. Skeleton when the shape is known.

Do not use pop in, bounce, spring, page transition, parallax, ripple, typewriter, idle animation, morph, ease-in, or slide in on product chrome. Sheets may slide.

Every recipe has a `prefers-reduced-motion` branch. Drop translate, scale, and rotate. Keep fade and color when they still explain the change.
