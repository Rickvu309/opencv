---
name: OpenPath
description: Monochrome light product UI. Conversation-first, bilingual, scarce colour.
colors:
  page: "oklch(0.98 0 0)"
  canvas: "oklch(0.958 0 0)"
  panel: "oklch(1 0 0)"
  ink: "oklch(0.16 0 0)"
  primary: "oklch(0.2 0 0)"
  primary-foreground: "oklch(0.99 0 0)"
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
typography:
  display:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  chat:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "40px"
  "4xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "oklch(0.2 0 0 / 0.8)"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.2xl}"
    height: "28px"
    padding: "0 12px"
  chip-idle:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.2xl}"
    height: "28px"
    padding: "0 12px"
---

# Design System: OpenPath

Tokens: `app/globals.css` (Tailwind classes). Who/why: `PRODUCT.md`. A colour, easing, duration, or radius not in this file is a review failure.

## 1. Overview

**Creative North Star: "The Daylight Desk"**

Paper-white panels on a grey canvas, near-black ink, 1px hairlines. Colour is status, never a surface. The chat is the product; every other screen is an artifact.

**Register:** product. Discover (`/`, auth, onboarding) shares tokens, not chrome.

| | Discover | Product |
| --- | --- | --- |
| Type | Display allowed | Fixed rem; page title `text-xl` |
| Motion | One first-load **Stagger** | No **Page transition**, no load **Orchestration** |
| Chrome | None | Inset frame, rail, dock |

**The Two-Register Rule.** No rail, dock, or ⌘K on Discover. No `text-5xl` or **Stagger** inside `/coach`.

**Key characteristics**

- Restrained monochrome. Semantic colour = dot, word, or one icon.
- Depth from three surfaces + hairlines, not shadows.
- Panels subdivided by rules. Never nested cards.
- One family: Be Vietnam Pro. Fixed rem in product.
- **Purposeful animation**, gated by **Frequency of use**, with **Reduced motion**.
- `{ vi, en }` pairs. Layout leaves room for both.
- WCAG 2.1 AA: contrast, keyboard, 40/44px targets, `lang`, diacritics unclipped.

Craft: Linear *product* surfaces, OpenAI chrome, Stripe dashboards. Not Linear’s dark marketing canvas, not lavender.

**The Token Rule.** Token classes only. No raw hex. No one-off `cubic-bezier`. No off-scale duration.

**The Grouping Rule.** Space groups first. Hairlines only *inside* a panel. Inter-group gap ≥ 2× intra-group.

**The Growth Rule.** Nothing is sized to one language. Rows wrap. Critical actions stay in flow or stable chrome.

**The Evidence Rule.** Numbers are computed. Empty opens at 0%. Invented scores are forbidden.

Density: rail `h-7` (`h-10` touch). Product page `max-w-6xl px-5 py-8 sm:px-8`. Discover `max-w-3xl px-5 sm:px-8 lg:px-12`, top-aligned. Sections `mt-10`, heading→content `mt-4`. Rows `px-4 py-3 divide-y`. Dock gutter `mb-12`. Safe area on mobile chrome. Screens never pad to clear the dock.

Copy: sentence case, verb-first. She is **the Coach** (no given name). Placeholders are examples. Counts are templated (`m.profile.itemCount(n)`).

A11y: body ≥ 4.5:1. Native elements. `:focus-visible` `ring-3 ring-ring/50`. Skip link first. Status is never colour alone. Display leading ≥ 1.2.

### Motion

**Purposeful animation.** **Frequency of use** decides. Keyboard actions (⌘K, ⌘B, Enter) never play **Enter / Exit**. CSS transitions for interruptible UI; **Keyframes** only as named recipes in `globals.css`. **Exit** faster than **Enter**. UI **Duration** ≤ 300ms except rare **Reveal** (500ms). Never `scale(0)`: **Scale in** from ≥ 0.93. **Hover effect** behind `@media (hover: hover) and (pointer: fine)`. Animate **Translate**, **Scale**, **Rotate**, opacity, colour; **Layout animation** only in **Accordion / Collapse**. Never `transition: all`. Never **Ease-in**.

| Frequency | Decision |
| --- | --- |
| 100+/day | Instant |
| Tens/day | Colour, or 120ms **Fade in / Fade out** |
| Occasional | 200–300ms **Enter / Exit**, **Origin-aware animation** |
| Rare / first-time | **Stagger**, 500ms **Reveal**, box **Float** |

| Token | Value | Use |
| --- | --- | --- |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Ease-out** for **Enter** |
| `--ease-exit` | `cubic-bezier(0.32, 0, 0.67, 0)` | **Exit**, collapse |
| `--ease-snap` | `cubic-bezier(0.2, 0, 0, 1)` | **Press / Tap feedback**, **Crossfade** |
| `--duration-press` | 120ms | Press, hover, colour |
| `--duration-state` | 200ms | **Crossfade**, state |
| `--duration-surface` | 300ms | Surface **Enter / Exit** |
| `--duration-reveal` | 500ms | **Reveal**, one blink |

Easings mint utilities (`ease-enter`). Durations do not: `duration-[var(--duration-surface)]`. A fourth curve or any other ms value is drift.

| Term | OpenPath |
| --- | --- |
| **Enter / Exit** | Dock, sheet, menu, toast, sidebar. Enter `--duration-surface` / `--ease-enter`; exit `--ease-exit`. |
| **Scale in** | Dock from `scale(0.93)`. Menus `zoom-in-95`. Never `scale(0)`. |
| **Origin-aware animation** | Dock `origin-bottom-right`; popovers `--radix-*-transform-origin`. Modals stay centered. |
| **Press / Tap feedback** | In-app `translate-y-px` on `Button`. Discover primary **Scale** `0.96`. No menu-trigger press. |
| **Stagger** | Discover `hero-enter` once. Empty kit, cap 3, 100ms. Map nodes, 40ms, capped. Never product load. |
| **Accordion / Collapse** | `.acc-panel`, `disclose()`. Inner **Fade in** + 3px **Translate**, 80ms **Delay**, `backwards`. Close 180ms. |
| **Crossfade** | Thread, language, dock mark↔close, `.t-text-swap`. Pair 2–4px **Blur**. Not **Text morph**. |
| **Reveal** | `.animate-bar-grow`. Reduced motion snaps width. |
| **Continuity transition** | `.animate-just-changed` wash. Reduced motion: outline. |
| **Drag** | Sidebar 208–400px; map pan/nodes 1:1 while down. Programmatic fit 300ms. |
| **Float** | Empty-kit mark only: 3px, 3s **Linear**. |
| **Loop** | Spinner, `ThinkingOrb` 1.7s **Linear**. Reduced motion: **Pulse** / centre cell. |
| **Shake / Wiggle** | `.field-error-shake` only. Error text is the channel. |
| **Skeleton / Shimmer** | Known shape. Spinner if unknown. |
| **Tabular numbers** | Any updating or columnar number. |

**Forbidden:** **Pop in**, **Bounce**, **Spring**, **Page transition**, **Parallax**, **Ripple**, **Typewriter**, **Idle animation**, **Morph**, **Slide in** on chrome (sheets ok), **Ease-in**.

**The Reduced-Motion Rule.** Every recipe has a branch. Drop **Translate** / **Scale** / **Rotate**. Keep **Fade in / Fade out** and colour if they carry meaning.

## 2. Colors

Chroma 0 neutrals. One near-black primary. Semantic colour ≤ a few dots per view. Token classes, never hex.

**Neutral.** Page `bg-background` (0.98). Canvas `bg-sidebar` (0.958), recedes. Panel `bg-card` (white), forward. Ink `text-foreground` (0.16): anything that must be read. Primary `bg-primary` (0.2): the one filled action. Fill `bg-muted` (0.965). Muted `text-muted-foreground` (0.505): labels/meta only, never body, never lightened. Hairline `border-border` (0.916), always 1px. Ring: focus only.

**Semantic.** `success` / `warning` / `danger` / `info`: dot (`size-1.5 rounded-full`), word, or one icon. Never a wash, card, or left stripe. Charts: `chart-1` attained, `chart-2` remainder. No rainbow.

**The Scarce Accent Rule.** One filled primary per view. Active chips/tabs may invert; that is state.

**The Scene Rule.** Light is the product. No theme toggle. `.dark` exists so forced dark does not invert into illegibility. Printed CV is always black on white.

## 3. Typography

**Display / body:** Be Vietnam Pro (`font-sans`). One family. Weight and size do hierarchy. No `clamp()` in product.

| Role | Spec | Where |
| --- | --- | --- |
| Display | `text-5xl sm:text-6xl font-semibold leading-[1.2] tracking-display text-balance` | Discover h1 only. Max 60px. |
| Display next | `text-xl sm:text-2xl font-medium leading-snug tracking-tight text-pretty` | Discover permission line. |
| Page title | `text-xl font-semibold tracking-tight text-balance` | Product h1. |
| Section | `text-base font-semibold tracking-tight` | Panel headings. |
| Body / cell | `text-sm` | Product UI. |
| Chat | `text-[15px] leading-7 text-pretty` | Coach replies. ≤ 75ch. |
| Label | `text-xs text-muted-foreground` | Meta, headers. Not instructions. |
| Metric | `text-2xl font-semibold tracking-tight tabular-nums` | Computed numbers only. |
| Rail | `text-[13px]` | Nav. |

**The Tracking Rule.** Bigger type, tighter tracking. `tracking-display` (−0.032em) at 40px+; `tracking-tight` below. Floor −0.04em.

**The Diacritic Rule.** Display leading ≥ 1.2. Body 1.5–1.75. `text-wrap: balance` on h1–h3; `pretty` on short prose. Inputs `text-base md:text-sm` (no iOS zoom).

## 4. Elevation

Tonal ladder, not shadows.

| Layer | Token | Job |
| --- | --- | --- |
| Canvas | `bg-sidebar` | Rail. Recedes. |
| Frame | `bg-background` | Inset sheet. |
| Panel | `bg-card` | Content, menus. |

**Inset frame.** `Sidebar variant="inset"`: rail borderless on canvas; content `m-2 ml-0 rounded-xl border shadow-sm`. `mb-12` is the dock gutter. Height-capped (`h-[calc(100svh-3.5rem)]`, `h-svh` mobile); scroll inside. Use `h-full`, never nested `100svh`. Active nav: `bg-card` + hairline (tab pulled forward). Hover: `bg-sidebar-accent`.

**The Flat-By-Default Rule.** Frame `shadow-sm`. Menus `shadow-md` + `ring-1 ring-foreground/10`. Dock panel `shadow-lg`. If a card needs a shadow to exist, it should have been a panel. Overlay dim: `bg-black/10`. Not glass on content.

| Radius | Use |
| --- | --- |
| 8 `rounded-md` | Inner controls |
| 12 `rounded-lg` | `Button`, `Input`, menus |
| 16 `rounded-xl` | Frame, dock, large panels |
| 24 `rounded-2xl` | User bubbles, pills |

Never `rounded-full` on a filled CTA. Concentric: outer = inner + padding. Overlays `z-50` (portals). Never `z-[999]`.

## 5. Components

shadcn/ui in `components/ui`. Compose; don’t restyle a primitive. States: default, hover, focus-visible, active, disabled. Icons: lucide `size-4`, outline at rest, fill when active.

### Buttons

`rounded-lg`, `h-8` (Discover primary `h-11`). One `bg-primary` per view. Ghost for in-panel edit. Destructive: `bg-destructive/10 text-destructive`, never a red fill. **Press / Tap feedback** on `Button`. Disabled: opacity 50; spinner *with* the label, only in flight.

### Chips

Active: primary invert. Idle: `border bg-card text-muted-foreground`. Rail counts: 11px numerals, never badge pills.

### Panels

House pattern: one bordered container, hairline subdivisions.

```tsx
<div className="overflow-hidden rounded-xl border bg-card">
  <div className="grid divide-x divide-border sm:grid-cols-3">…</div>
</div>
```

Tables: `text-xs` header on `bg-muted/50`, `divide-y`, `hover:bg-muted/40`. `Card` only for discrete objects (CV posters). Everywhere else, a panel.

### Inputs

`h-8`, transparent, `border-input`. Focus: `ring-3 ring-ring/50`. Error: `aria-invalid` + inline text. `Field` owns the label. **Shake / Wiggle** is optional.

### Navigation

Linear product rail. Quiet. Coach unlabelled (daily home, box mark). Then **Prepare** / **Opportunities** (`Collapsible`, open). Profile is Settings, not a kit item. Chats: stored threads only; new chat in header `ChatSwitcher`. Rows 28/40px. No footer. `?` bottom-left. ⌘K keyboard-only; no Search button.

Rail resizable 208–400px (**Drag** to `--sidebar-width`, persist on release). Hideable (`offcanvas`); no icon stub. Reopen is explicit (header toggle when collapsed; always on mobile). ⌘B does not animate; the rail **Enter / Exit** is the pointer path.

### Feedback

`Spinner`: **Rotate** **Loop**; reduced motion **Pulse**. Coach thinking: `ThinkingOrb`. Toasts top-center, 4s; undo stays. `<Tip>`: two or three per screen, max.

### Discover

One column, one promise, two doors. No chrome, demo, pillars, metrics. `hero-enter` **Stagger** once; reduced motion keeps **Fade in**. Onboarding: name, direction, optional CV → `/coach?q=`. Language: segmented pair on Discover/onboarding; `?` menu in-app. Each language names itself.

### Languages

`{ vi, en }` pairs, structure may differ. State in `AppState`. Composer Vietnamese → switch once with undo (`looksVietnamese`); never the reverse. CV language ≠ UI language is a real case. `<html lang>` follows the UI. Language swap: **Crossfade**.

### Mark

`components/brand/coach-box.tsx`. Outline at rest, filled when Coach is active. Four poses: Sit, Listen, Think (= Sit), Done (one blink). **Float** on empty-kit only. Not on billing, help, print, toasts. Never a fifth pose, name, **Idle animation**, **Pop in**.

### Coach

Two views, one thread (`useCoach()`). `/coach` vs dock: layout differs, state does not. Unbubbled coach prose `text-[15px] leading-7`; user `rounded-2xl bg-muted`. Empty: mark + greeting + composer (**Stagger** cap 3). Composer: textarea, `+` (**Rotate** 45°), send. No model picker. Thread **Crossfade**. Confirmations from `apply_action`, not prose. Send → stop while streaming.

**Dock.** Bottom gutter strip on every screen except mobile `/coach`. In flow below `md` (shared row with `?`). Panel `w-[min(24rem,100vw-2rem)]`, **Origin-aware animation** + **Scale in** 0.93, **Exit** faster, mark **Crossfade**. Never pad a screen to clear it.

**Coach edits.** Act (same registry action). Announce (toast + Hoàn tác). Reveal (product step): `useTouched()` **Continuity transition**. Screens render from the store.

### Hồ sơ

Workbench: 20rem index + inspector; push below `md`. Empty = the form. `EditableSection` + sticky Huỷ/Lưu. Draft until save.

### My Paper

Library of A4 posters. Open = type on the page. Document colours are the document’s, always black on white. Commit on blur. Print via `data-print-portal`.

### Career Map

Map, not a list. HTML `<button>` nodes, SVG edges. Inspector is a split, never an overlay. **Drag** 1:1; fit **Ease-out** 300ms; node **Stagger** 40ms capped.

## 6. Do's and Don'ts

### Do

- **Do** keep the desk quiet: hairlines, ink, one filled primary, one next step.
- **Do** treat `/coach` and the dock as two views of one thread.
- **Do** subdivide a panel; don’t start a card grid.
- **Do** write `{ vi, en }`, name each language in itself, leave room.
- **Do** name motion from the vocabulary, spell **Duration** from tokens, honour **Reduced motion**.
- **Do** Act / Announce / Reveal from the store, with undo.
- **Do** show computed numbers, and 0% when there is no evidence.

### Don't

- **Don't** ship confetti, badges, personality-test astrology, or HR KPI grids.
- **Don't** ship hero-metric templates, identical card grids, or cream/beige AI palettes.
- **Don't** bolt Coach on as a support widget. No sparkles, AI-glow, or brand **Pulse**.
- **Don't** use colour as a fill, a left stripe, or gradient text. Don’t glass content cards.
- **Don't** put a tracked uppercase eyebrow or `01 / 02 / 03` on every section.
- **Don't** nest cards, add a fourth surface, a theme toggle, or `transition: all`.
- **Don't** animate keystrokes, rail clicks, or ⌘K. Don’t **Pop in**, **Bounce**, **Spring**, **Parallax**, **Typewriter**.
- **Don't** invent a fit number, size chrome to one language, or pad to clear the dock.
- **Don't** use `z-[999]`, raw hex, muted as body, or a duration other than 120 / 200 / 300 / 500.
