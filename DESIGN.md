---
name: OpenPath
description: Monochrome light product UI. Conversation-first, scarce colour.
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

Tokens live in `app/globals.css` and are used as Tailwind classes. `PRODUCT.md` covers who and why. A colour, easing, duration, or radius missing from this file fails review.

## 1. Overview

**Creative North Star: "The Daylight Desk"**

White panels on a grey canvas, near-black ink, 1px hairlines. Colour marks status. Chat is the product; other screens are artifacts of the conversation.

Register is **product**. Discover (`/`, auth, onboarding) uses the same tokens and none of the app chrome.

| | Discover | Product |
| --- | --- | --- |
| Type | Display size allowed | Fixed rem. Page title is 20px (`text-xl`) |
| Motion | One first-load **Stagger** | No **Page transition**. No load **Orchestration** |
| Chrome | None | Inset frame, rail, dock |

**The Two-Register Rule.** Discover has no rail, dock, or command palette. Product pages have no display type and no **Stagger**.

- Monochrome. Semantic colour is a dot, a word, or one icon.
- Depth from three surfaces and hairlines.
- One bordered panel, subdivided. No nested cards.
- Be Vietnam Pro only. Fixed rem in product.
- **Purposeful animation**, limited by **Frequency of use**, with **Reduced motion**.
- Copy is English. Layout still wraps; do not size chrome to one sentence.
- WCAG 2.1 AA: 4.5:1 body, keyboard, 40px chrome / 44px primary, `lang`, unclipped diacritics.

References: Linear's product app, OpenAI's product chrome, Stripe dashboards. Linear's dark marketing site and lavender accent stay out.

**The Token Rule.** Use token classes. Raw hex, a one-off `cubic-bezier`, and an off-scale duration fail review.

**The Grouping Rule.** Group with space. Hairlines only inside a panel. Gap between groups is at least twice the gap inside a group. A heading and its supporting line are related text: they take the inner gap.

**The Growth Rule.** Rows wrap. Primary actions stay in flow or in the shell.

**The Evidence Rule.** Show computed numbers. An empty profile is 0%. Invented scores fail review.

**The Optical-Pad Rule.** Vertical padding around text is slightly tighter than horizontal, because line-height already adds space. Prefer `px-5 py-4` to `p-5`. List rows stay `px-4 py-3`.

**The Sticky-Edge Rule.** Sticky chrome uses `border-b border-border` (or `border-t`) so it separates from scrolling content.

Rail rows are 28px, 40px on touch. Product page is `max-w-6xl` with `px-5 py-8 sm:px-8`. Discover is `max-w-3xl` with `px-5 sm:px-8 lg:px-12`, aligned to the top. Sections sit `mt-10` apart; a heading sits `mt-4` above its content. List rows are `px-4 py-3` with `divide-y`. The dock gutter is 48px (`mb-12`). Mobile chrome includes the safe area. Do not add page padding to clear the dock.

UI copy is sentence case and verb-first. The Coach has no given name. Placeholders show an example, not a label. Counts are whole templates (`m.profile.itemCount(n)`).

Focus uses `:focus-visible` and `ring-3 ring-ring/50`. Native controls first. Skip link is the first tab stop. Status always has a non-colour cue. Display leading is at least 1.2.

### Motion

Motion has a job: orient, give feedback, or show a relationship. **Frequency of use** decides whether it runs. Keyboard actions (⌘K, ⌘B, Enter) have no **Enter / Exit**. Use CSS transitions so UI can be interrupted. Put **Keyframes** only in named recipes in `globals.css`. **Exit** is faster than **Enter**. Product UI stays at or under 300ms; a rare **Reveal** may use 500ms. **Scale in** starts at 0.93 or above, never `scale(0)`. Gate **Hover effect** with `@media (hover: hover) and (pointer: fine)`. Animate **Translate**, **Scale**, **Rotate**, and opacity. **Layout animation** belongs only in **Accordion / Collapse**. `transition: all` and **Ease-in** fail review.

**The Instant-Hover Rule.** Colour on hover is immediate. `transition-colors` on hover fails review. Press still uses `--duration-press`. Colour that marks a state (selected, invalid) may use `--duration-press`.

| Frequency | Decision |
| --- | --- |
| 100+/day | Instant |
| Tens/day | Instant hover colour, or 120ms **Fade in / Fade out** |
| Occasional | 200–300ms **Enter / Exit**, **Origin-aware animation** |
| Rare / first-time | **Stagger**, 500ms **Reveal**, box **Float** |

| Token | Value | Use |
| --- | --- | --- |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Ease-out** on **Enter** |
| `--ease-exit` | `cubic-bezier(0.32, 0, 0.67, 0)` | **Exit**, collapse |
| `--ease-snap` | `cubic-bezier(0.2, 0, 0, 1)` | **Press / Tap feedback**, **Crossfade** |
| `--duration-press` | 120ms | Press. State colour. Not hover colour |
| `--duration-state` | 200ms | **Crossfade**, state |
| `--duration-surface` | 300ms | Surface **Enter / Exit** |
| `--duration-reveal` | 500ms | **Reveal**, one blink |

`--ease-*` tokens create utilities (`ease-enter`). `--duration-*` tokens do not. Write `duration-[var(--duration-surface)]`. A fourth curve, or any other millisecond value, fails review.

| Term | Where |
| --- | --- |
| **Enter / Exit** | Dock, sheet, menu, toast, sidebar. Enter uses `--duration-surface` and `--ease-enter`. Exit uses `--ease-exit`. |
| **Scale in** | Dock from `scale(0.93)`. Menus `zoom-in-95`. |
| **Origin-aware animation** | Dock from `origin-bottom-right`. Popovers from `--radix-*-transform-origin`. Modals stay centered. |
| **Press / Tap feedback** | `translate-y-px` on `Button`. Discover primary scales to `0.96`. Menu triggers have no press motion. |
| **Stagger** | Discover `hero-enter`, once. Empty kit, three items, 100ms. Map nodes, 40ms, capped. Never on product load. |
| **Accordion / Collapse** | `.acc-panel` and `disclose()`. Inner **Fade in** plus 3px **Translate**, 80ms **Delay**, `backwards`. Close in 180ms. **The Collapse-Size Rule:** the inner child keeps its width or height while the clip closes. Do not `w-full min-w-0` a collapsing pane. |
| **Crossfade** | Thread, language, dock mark and close, `.t-text-swap`. Add 2–4px **Blur**. Not **Text morph**. |
| **Reveal** | `.animate-bar-grow`. Reduced motion jumps to the final width. |
| **Continuity transition** | `.animate-just-changed` wash. Reduced motion uses an outline. |
| **Drag** | Sidebar 208–400px. Map pan and nodes track 1:1. Programmatic fit takes 300ms. |
| **Float** | Empty-kit mark only. 3px, 3s, **Linear**. |
| **Loop** | Spinner and `ThinkingOrb` (1.7s **Linear**). Reduced motion uses **Pulse** or the centre cell. |
| **Shake / Wiggle** | `.field-error-shake` only. The error text carries the meaning. |
| **Skeleton / Shimmer** | When the shape is known. Spinner when it is not. |
| **Tabular numbers** | Any number that updates or sits in a column. |

Do not use **Pop in**, **Bounce**, **Spring**, **Page transition**, **Parallax**, **Ripple**, **Typewriter**, **Idle animation**, **Morph**, **Ease-in**, or **Slide in** on product chrome (sheets may slide).

**The Reduced-Motion Rule.** Every recipe has a `prefers-reduced-motion` branch. Drop **Translate**, **Scale**, and **Rotate**. Keep **Fade in / Fade out** and colour when they still explain the change.

## 2. Colors

Restrained: grey surfaces, one near-black primary, semantic colour on a few marks per screen. Use token classes.

### Neutral

- **Page** (`bg-background`): content frame and Discover canvas.
- **Canvas** (`bg-sidebar`): rail. Recedes.
- **Panel** (`bg-card`): white sheets, menus, posters. Comes forward.
- **Ink** (`text-foreground`): headings, values, body.
- **Primary** (`bg-primary`): the one filled action. Text is `text-primary-foreground`.
- **Fill** (`bg-muted`): idle chips, tracks, user bubbles.
- **Muted** (`text-muted-foreground`): labels and meta. Never body, never the only text, never lightened.
- **Hairline** (`border-border`): every edge and divider, 1px.
- **Ring** (`ring-ring`): focus only.

### Semantic

`success`, `warning`, `danger`, `info` as a 6px dot, a status word, or one icon. No wash, no coloured card, no left stripe. Charts use `chart-1` for the attained value and `chart-2` for the rest.

**The Scarce Accent Rule.** One filled primary per view. If a second control is filled, it is wrong. An active chip or tab may invert; that is state.

**The Scene Rule.** Ship light. No theme toggle. `.dark` exists so a forced dark scheme stays readable. A printed CV is black on white in every theme.

## 3. Typography

Be Vietnam Pro (`font-sans`) for everything. Size and weight make hierarchy. No second family. No `clamp()` in product.

| Role | Size and treatment | Where |
| --- | --- | --- |
| Display | 48–60px, semibold, leading 1.2, `tracking-display`, `text-balance` | Discover headline only |
| Display next | 20–24px, medium, snug, `tracking-tight`, `text-pretty` | Line under the Discover headline |
| Page title | 20px, semibold, `tracking-tight`, `text-balance` | Product `h1` |
| Section | 16px, semibold, `tracking-tight` | Panel headings |
| Body | 14px (`text-sm`) | Product UI, tables, forms |
| Chat | 15px, leading 1.75, `text-pretty`, measure ≤ 75ch | Coach replies |
| Label | 12px, muted | Meta and table headers, not instructions |
| Metric | 24px, semibold, `tracking-tight`, tabular | Computed numbers |
| Rail | 13px | Nav rows |

**The Tracking Rule.** Larger type gets tighter tracking. Use `tracking-display` (−0.032em) from 40px up, `tracking-tight` below. Do not go tighter than −0.04em. Body, buttons, and labels keep default tracking; no `tracking-*` on those.

**The Weight Rule.** Never `font-bold`. Headings are `font-semibold`. Inline emphasis is `font-medium`.

**The Inline-Mono Rule.** `font-mono` inside a sentence is `text-[0.9em]`. Mono is for fragments (paths, keys), not a second brand family.

**The Diacritic Rule.** Display leading is at least 1.2 so Vietnamese tone marks clear. Body is 1.5–1.75. Balance headings (`h1`–`h3`). Use `text-pretty` on short prose. Inputs are `text-base` on mobile, `text-sm` from `md`, so iOS does not zoom.

## 4. Elevation

Hierarchy comes from stepped surfaces.

| Layer | Token | Role |
| --- | --- | --- |
| Canvas | `bg-sidebar` | Rail. Recedes. |
| Frame | `bg-background` | Inset sheet. |
| Panel | `bg-card` | Content and menus. |

The shell is Linear's inset frame. The rail sits on the canvas with no border. Content is `m-2 ml-0 rounded-xl shadow-sm ring-1 ring-border`. The 48px bottom margin (`mb-12`) is the dock gutter. The frame is height-capped (`h-[calc(100svh-3.5rem)]`, `h-svh` on mobile) and scrolls inside. Full-height views use `h-full`, not nested `100svh`. The active nav item uses `bg-card` and a hairline, like a tab pulled forward. Hover uses `bg-sidebar-accent`.

**The Flat-By-Default Rule.** The frame may use `shadow-sm` with `ring-1 ring-border`. Menus use `shadow-md` and `ring-1 ring-foreground/10`. The dock panel uses `shadow-lg` because it floats. A card that needs a shadow to read as a card should have been a panel. Overlay dim is `bg-black/10`. No glass on content.

**The Shadow-Ring Rule.** Never pair `border` with a drop shadow. Shadowed surfaces use `ring-1 ring-border`. A hairline with no shadow stays `border-border`.

| Radius | Use |
| --- | --- |
| 8px (`rounded-md`) | Inner controls |
| 12px (`rounded-lg`) | Button, input, menus |
| 16px (`rounded-xl`) | Frame, dock, large panels |
| 24px (`rounded-2xl`) | User bubbles, pills |

A filled primary is never a pill. Nested radii stay concentric (outer = inner + padding). Overlays use `z-50` via portals. `z-[999]` fails review.

## 5. Components

Primitives live in `components/ui` (shadcn/ui, Radix). Compose them. Do not restyle a primitive in place. Every control has default, hover, focus-visible, active, and disabled. Lucide icons are 16px, outline at rest, filled when they mark the active state.

**The Icon-Line Rule.** Inline icons sit on the first line of text. Wrapping rows use `items-start`; wrap the icon in `h-lh flex items-center`. `items-center` on a wrapping row fails review.

### Buttons

12px radius, 32px tall. Discover primary is 44px. One filled primary per view. Ghost for in-panel edit. Destructive is tinted danger text (`bg-destructive/10 text-destructive`), never a red fill. **Press / Tap feedback** lives on `Button`. Disabled is 50% opacity. Show a spinner with the original label, and only while the request is in flight.

### Chips

Active inverts to primary. Idle is a hairline on a white panel, muted text. Rail counts are 11px numerals. No badge pills.

### Panels

The house pattern is one bordered container, split by hairlines. Do not nest a panel inside a panel.

```tsx
<div className="overflow-hidden rounded-xl border bg-card">
  <div className="grid divide-x divide-border sm:grid-cols-3">…</div>
</div>
```

Table headers are 12px muted on a light fill, with `divide-y` and a muted row hover. Use `Card` for objects you can pick up (the Coach's CV thumbnail). Use a panel everywhere else.

### Inputs

32px, transparent fill, hairline. Focus adds the ring. Errors use `aria-invalid` and text under the field. `Field` owns the label. **Shake / Wiggle** is optional.

### Dialogs

**The Dialog-Mount Rule.** Never `{open && <Dialog>}`. Keep the dialog mounted and drive it with `open` / `onOpenChange`, or the open/close motion will not run.

### Navigation

Quiet Linear rail. Coach has no section label; it is home, with the box mark. **Prepare** and **Opportunities** are collapsible and open. Profile is Settings, not a kit row. Chats lists stored threads. New chat lives in the header `ChatSwitcher`. Rows are 28px, 40px on touch. No footer. Help (`?`) sits bottom-left. ⌘K is keyboard-only. There is no Search button in the rail.

The rail resizes 208–400px by **Drag** on `--sidebar-width`, saved on release. It hides fully (`offcanvas`), with no icon stub. Reopening is explicit: a header toggle when collapsed, always visible on mobile. ⌘B does not animate. The rail **Enter / Exit** follows the pointer.

### Feedback

`Spinner` is a **Rotate** **Loop**. Reduced motion uses **Pulse**. Coach thinking uses `ThinkingOrb`. Toasts sit top-center for 4s. Undo stays until used. `Tip` appears at most two or three times per screen.

### Discover

One column, one promise, two doors. No chrome, demo, pillars, or metrics. `hero-enter` **Stagger** runs once; reduced motion keeps **Fade in**. Onboarding is name, direction, optional CV, then `/coach?q=`. The product is English. `<html lang="en">`.

### Mark

One SVG (`components/brand/coach-box.tsx`). Outline at rest, filled when Coach is the active surface. Four poses: Sit, Listen, Think (same as Sit), Done (one blink). **Float** only on the empty-kit greeting. Keep it off billing, help, print, and toasts. No fifth pose, no name, no **Idle animation**, no **Pop in**.

### Coach

Two views, one thread (`useCoach()`). `/coach` and the dock differ in layout only. Coach replies are unbubbled 15px prose. User turns are a muted 24px-radius bubble. Empty state is mark, greeting, composer, **Stagger** of three. Composer is a textarea, a `+` that **Rotate**s 45°, and send. No model picker. Switching threads is a **Crossfade**. Confirmations come from `apply_action`. Send becomes stop while streaming.

The dock is a strip in the bottom gutter on every screen except mobile `/coach`. Below `md` it sits in flow, in one row with help. The panel is at most 24rem wide, **Origin-aware animation**, **Scale in** from 0.93, faster **Exit**, mark **Crossfade**. Do not pad a page to clear the strip.

Coach edits: Act through the same registry action. Announce with a toast and Undo. Reveal (the product step) with `useTouched()` **Continuity transition**. Screens read from the store.

### My Profile

A workbench: 20rem index and an inspector. Below `md` the panes push. An empty section is the form. `EditableSection` uses a sticky Cancel / Save bar. Edits stay in a draft until save.

### My Paper

A Drive, then a Docs. `/paper` is home even with one paper: flat rows — name · type word · updated — of built papers and uploaded files. No folders, no poster grid. Uploads read `Uploaded` with a file icon and open as preview/download, never an editor; OpenPath does not parse them, and they do not count as a built CV. Open a paper at `/paper?id=` into its own chrome: Back, editable title, type label, Export. No CV | Letter tabs and no in-editor switcher — the list is how you switch. Application, Coach, Profile, and onboarding open this same chrome; nobody types on a kanban card or in a chat bubble.

Types: CV, cover letter, Proof. The CV word follows the template's audience — Vietnamese employer, internship, academic, service, and one page say CV; abroad/ATS, technical, and design say Resume. A new CV opens that eight-tile situation gallery; accent and spacing stay in the Format bar. A new letter asks the situation — posted job, internship, speculative, scholarship — then gives the page; no letter skins. An open CV is structured fields beside the live A4. Letters are typed on the page. Document colour is the document's: black on white, in every theme. Commit on blur. Print through `data-print-portal`; Export is PDF via the print dialog. Completeness sits on the open CV and the Coach thumbnail, never on a row.

A Proof is a running dump: title, optional role · dates · link, then notes and photos, newest first. Prepare publishes a designed share page; published Proofs collect on one personal link with a quiet mark — no feed, no follow, no streaks. A Proof may sound human in ways a CV must never; its content can be reused on a CV, never auto-inserted. An empty Proof teaches what already counts (a class project, a shift, a failed experiment) and can suggest one from the profile — never required.

The empty list is one next step: build the CV you'll send tonight. Profile is in the account menu, not this rail.

### My Pitch

Bio and intro share one panel. Interview answers sit below as a list. Writing is the work; Coach is a quiet offer.

### My Search

One search field, then a ranked list. Fit is evidence from the profile, never a badge.

### My Application

A board. Status is a verb the user takes, announced through the store.

## 6. Craft

Kumo rules, written in OpenPath tokens. Do not import `LayerCard`, `Text`, or `kumo-*` classes.

| Kumo | OpenPath |
| --- | --- |
| Content text 14px; 16px+ is headings | §3. Chat 15px, rail 13px, labels 12px |
| Sentence-case headings; product names title case | Copy is sentence case |
| Never change tracking on body or controls | **The Tracking Rule** |
| Never `font-bold` | **The Weight Rule** |
| Related text closer than the group | **The Grouping Rule** |
| Optical pad around text | **The Optical-Pad Rule** |
| Never transition hover colour | **The Instant-Hover Rule** |
| Never `border` plus a drop shadow | **The Shadow-Ring Rule** |
| Concentric nested radii | §4 |
| Icons aligned to the first line of text | **The Icon-Line Rule** |
| Inline mono slightly smaller | **The Inline-Mono Rule** |
| Sticky chrome gets a hairline | **The Sticky-Edge Rule** |
| Collapse keeps content size | **The Collapse-Size Rule** |
| Never nest cards | §5 Panels |
| Never conditionally render dialogs | **The Dialog-Mount Rule** |

## 7. Do's and Don'ts

### Do

- **Do** use hairlines, ink, one filled primary, and a visible next step.
- **Do** treat `/coach` and the dock as two views of one thread.
- **Do** subdivide a panel before you reach for a card grid.
- **Do** write sentence-case English, and leave room for wrapping.
- **Do** name motion from the vocabulary, take **Duration** from tokens, and honour **Reduced motion**.
- **Do** Act, Announce, and Reveal from the store, with undo.
- **Do** show computed numbers, and 0% when there is no evidence.
- **Do** keep dialogs mounted, hover colour instant, and icons on the first line of wrapping text.
- **Do** use a ring on a shadowed surface.

### Don't

- **Don't** ship confetti, badges, personality-test astrology, or HR KPI grids. (`PRODUCT.md`)
- **Don't** ship hero-metric templates, identical card grids, or cream/beige AI palettes. (`PRODUCT.md`)
- **Don't** treat Coach as a support widget. No sparkles, AI-glow, or brand **Pulse**. (`PRODUCT.md`)
- **Don't** fill a surface with semantic colour, add a left stripe, use gradient text, or put glass on a card.
- **Don't** put a tracked uppercase eyebrow or `01 / 02 / 03` above every section.
- **Don't** nest cards, add a fourth surface, add a theme toggle, or write `transition: all`.
- **Don't** animate keystrokes, rail clicks, or ⌘K. Don't use **Pop in**, **Bounce**, **Spring**, **Parallax**, or **Typewriter**.
- **Don't** invent a fit number, or pad a page to clear the dock.
- **Don't** use `z-[999]`, raw hex, muted ink for body, or a duration other than 120 / 200 / 300 / 500.
- **Don't** use `font-bold`, `transition-colors` on hover, or `border` plus a drop shadow.
- **Don't** mount a dialog with `{open && …}`. Don't `items-center` a row whose text can wrap.
