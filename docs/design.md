# OpenPath design system

The visual authority for the prototype. Every rule here is one the codebase
already follows, or is being brought into line with as part of RDS-984. If a
component disagrees with this file, the component is wrong, fix the
component, not this file, unless the fix reveals the rule itself was wrong,
then update both together.

Read this after `docs/architecture.md` (product structure) and
`CONTEXT.md` (domain words). This file governs pixels and tokens, not
product behavior.

## 1. Color

All colors are OKLCH CSS custom properties in `app/globals.css`, consumed
through Tailwind's `@theme inline` mapping (`bg-background`,
`text-muted-foreground`, and so on). Never a raw hex or an arbitrary OKLCH
value inline in a component; if a surface or text level is missing, add the
token, don't hand-roll a color.

### Surface levels (back to front)

| Level | Token | Use |
|---|---|---|
| Page | `--background` | The app canvas behind everything |
| Sidebar | `--sidebar` | The nav rail, one step off the page canvas |
| Card | `--card` | Cards, the default resting surface for content blocks |
| Popover | `--popover` | Dialogs, dropdowns, tooltips, the toaster: anything that floats above the page |
| Sunken | `--muted` | Recessed content inside a card: empty states, the dialog footer strip, code-like blocks |
| Hover tint | `--accent` | Hover/pressed background for an otherwise-transparent row or menu item |

Card and popover are visually near-identical (both near-white) by design:
the distinction that matters is z-order and the ring, not a shade
difference. Don't invent a second "elevated card" surface token; a card that
needs to stand out earns a ring or accent treatment (see Emphasis below),
not a darker fill.

### Border levels

| Level | Token / class | Use |
|---|---|---|
| Structural | `--border` (`border-border`) | Table/list row dividers, dialog footer's top rule, tab underlines |
| Card edge | `ring-foreground/8` (not `border`) | The default resting edge on every `Card`. A hairline ring, not a filled border, so it reads as a boundary, not a box |
| Card edge, hovered/interactive | `ring-foreground/20` | Hover state on a navigable card (`ObjectCard`, board cards) |
| Card edge, emphasized | `ring-primary/25` or `ring-2 ring-primary` | A card carrying real significance: a confirmed Highlight entry, a deep-linked/scrolled-to card |
| Dashed | `border-2 border-dashed border-indigo-300 ring-0` | Draft/unconfirmed AI content only (see AI indigo below). Always pair an explicit `border` width with `border-dashed`; `border-dashed` alone renders nothing against this repo's zeroed base border-width (lessons.md #28) |

Cards use a ring, not a border, because a ring composites outward without
shifting layout on hover and stays crisp at the low contrast this palette
needs for a calm surface. Don't add `border` to a `Card` for emphasis; adjust
the ring instead.

### Text levels

| Level | Token | Use |
|---|---|---|
| Primary | `--foreground` | Titles, primary reading text, values |
| Secondary | `--muted-foreground` | Meta lines, timestamps, supporting sentences, placeholder-style hints |
| On-accent | `--accent-foreground` / `--primary-foreground` / `--secondary-foreground` | Text sitting on a filled accent/primary/secondary surface, never assume white |
| Disabled | `text-muted-foreground` at reduced opacity via the control's own `disabled:opacity-50`, not a fourth text token | Disabled controls only |

Never drop below `muted-foreground` for anything a user needs to read. A
third, lighter "tertiary" text gray is not part of this system; if
something feels like it needs to be quieter than `muted-foreground`, it
should probably not be on the page at all (progressive disclosure), not
rendered in near-invisible gray.

### One product accent

`--primary` (a near-ink navy, not a bright brand blue) is the product's one
accent: primary buttons, the active nav item, the "you are here" ring on a
deep-linked card, `Progress` fill. It is deliberately quiet and dark, not
saturated, because it competes with the AI indigo for attention and it must
lose that competition everywhere except the controls that are genuinely the
user's own action (never AI-authored). One accent, used for one job:
marking the user's own primary action or position, not decoration.

### The reserved AI indigo

Indigo (Tailwind's `indigo-*` scale, light tint + border in light mode,
`/10`-`/15` opacity fill in dark mode) is reserved entirely for
Copilot-attributed content: the `CopilotTag`, `ConfidenceChip`, the
five-beat AI block family, a draft candidate's dashed ring
(`candidate-card.tsx`), an AI-highlighted/deep-linked card that arrived via
a Copilot Focus item, a "Copilot pick" badge on a suggested resource. If a
block doesn't carry a `CopilotTag` or sit inside one of `components/ai/`,
it does not get indigo. This is the one rule with zero exceptions in this
pass: indigo is the single visual signal for "the system said this, not
you," and it stops meaning that the moment it leaks into a plain UI
element. `SkillLevelMeter`'s level dots used indigo for a plain progress
meter with no Copilot attribution nearby; fixed to `--primary` in this pass
(section 3) as the one violation found.

### Semantic status colors

Three status meanings, each with a light-mode tint-on-white pairing and a
dark-mode `/10`-`/20` opacity pairing, defined once per meaning and reused
everywhere rather than re-picked per component:

| Meaning | Color | Used for |
|---|---|---|
| Success / positive | `emerald` | Offer status, Strong fit, "on track" goal, "passes checks" credibility, a completed/confirmed state |
| Warning / needs attention | `amber` | "needs attention" goal/source status, Medium fit, Medium priority, a stale-but-not-failed state |
| Destructive / negative | `--destructive` token (a red-orange, not raw `rose-*`) for real destructive actions (delete buttons, the destructive badge variant); `rose-*` for negative-but-not-destructive chip semantics (Weak fit, High priority, "fails checks" credibility). These read as the same hue family so a user never has to learn two different "this is bad" colors, but they are not merged into one token because a delete button and a "Weak fit" chip are different weights of "negative" and the destructive token carries real focus-ring and hover behavior a chip doesn't need |
| Neutral | `slate` / `muted` | Saved/Closed status, Low priority, Unknown fit, "parked" goal |

These four meanings are the only ones a chip or status indicator may use.
Don't introduce a fifth hue for a new status; map it onto one of these four
first and only add a new meaning if none of the four honestly fits.

### The chip color map

Every chip in the product (`StatusChip`, `FitChip`, `PriorityChip`,
`ConfidenceChip`, `CredibilityChip`, `GoalStatusChip`, `SourceStatusChip`)
is built on the one `Chip` primitive (`components/shared/chip.tsx`: a
`Badge variant="outline"` with a dot or icon plus a label) and draws its
colors from the shared tone table in `components/shared/chip-tones.ts`
(added in this pass, section 3) so the literal Tailwind strings for
"success," "warning," "danger," and "neutral" exist in exactly one place
instead of being retyped per chip file. A chip's own file maps its domain
values (`Strong`/`Medium`/`Weak`/`Unknown`, `Saved`/`Applied`/...) onto one
of those four tones; it never invents a new color pairing locally.

Confidence is the one chip type that uses indigo instead of a status tone,
because confidence is inherently a Copilot-attributed judgment (`Gauge`
icon, "High/Medium/Low confidence"), not a status.

## 2. Type scale

One family end to end (IBM Plex Sans, `--font-display-sans`), no second
display face. Six named steps, each with one job:

| Step | Class | Weight/leading | Use |
|---|---|---|---|
| Display | `.text-display` (`text-3xl leading-[1.15] font-semibold tracking-tight`) | One step above h1 | The single hero line per page: Home's greeting, a direction band's target-direction sentence. At most one per page, always the first thing on the page |
| H1 | `<h1>` (`text-2xl leading-tight font-semibold tracking-tight`) | Page title | Exactly one per page, lives in `PageHeader`, never re-set by a page |
| H2 | `<h2>` (`text-lg leading-snug font-semibold tracking-tight`) | Section title | One per major section inside a page (a card group's own heading, e.g. "Highlights," "Signals," "Alternatives") |
| H3 | `<h3>` (`text-base leading-snug font-semibold`) | Card/subsection title | `CardTitle` and nested subsection headings inside a section |
| Body | `text-sm` (default) | Reading weight | Card copy, form values, list rows. The prototype's working size; don't drop main content to `text-xs` for density, use spacing instead |
| Meta | `text-xs text-muted-foreground` | Supporting weight | Timestamps, counts, helper text, evidence source lines |
| Section label | `.text-section-label` (`text-[11px] font-semibold tracking-wide text-muted-foreground/80 uppercase`) | Quiet group header | Groups a dense list without adding another heading level: sidebar nav groups, Home's "Needs a decision" / "Also worth a look" split, a card grid's category header |

Rules: never skip from H1 straight to body without an H2 if a page has more
than one real section. Never use `.text-display` twice on one page. A
section label is not a smaller H2, it never gets its own icon or action
button, it exists purely to chunk a list per Miller's Law.

## 3. Spacing rhythm

Built on Tailwind's 4px step, used at a small, disciplined set of stops.
Always `gap-*` in a flex/grid container, never `space-y-*`/`space-x-*`
(matches the shadcn skill's styling rule).

| Stop | Use |
|---|---|
| `gap-1` / `gap-1.5` | Inline chip rows, icon-plus-label pairs |
| `gap-2` | Compact vertical stacks inside a card (label + value pairs), form field spacing |
| `gap-3` | The default card-internal rhythm (`--card-spacing` at `size="default"`), spacing between related but distinct rows |
| `gap-4` | Spacing between a card's header and body when they need more separation than the default, spacing between sibling controls in a toolbar |
| `gap-6` | The page-level rhythm: every template's content column uses `flex flex-col gap-6` between major sections, and `p-6` as the page's outer padding |

A component that needs a stop between two of these should round up to the
larger one rather than introduce a `gap-2.5` or `gap-5` one-off; the small,
closed set of stops is what keeps density legible at a glance.

## 4. Radius and elevation

| Level | Token/class | Use |
|---|---|---|
| Small | `rounded-md` | Inputs, small controls, inline code-like chips |
| Default | `rounded-lg` | Buttons, list rows, most inline controls |
| Card/dialog | `rounded-xl` | `Card`, `DialogContent`, any floating panel |
| Pill | `rounded-full` / `rounded-4xl` | `Badge`/`Chip`, avatars |

Elevation is expressed with a hairline `ring`, not `box-shadow`. Default
resting card: `ring-1 ring-foreground/8`. Hover on a navigable card:
`ring-foreground/20`. Floating layers (`Dialog`, `Popover`, dropdowns) get
`ring-1 ring-foreground/10` plus the browser's own backdrop blur on the
overlay, not a drop shadow. Reserve actual `shadow-*` utilities for the
handful of shadcn primitives that already ship with one internally (button
press states); don't add new `shadow-md`/`shadow-lg` to a custom
component, it reads as heavier and more "demo" than this system wants.

`Sheet` (first real usage: Home's decision drawer, RDS-993) is a floating
layer too, but a docked one, not a free one, so it keeps its vendored
`shadow-lg` (the primitive's own built-in exemption above) and its single
inner-edge `border-l`/`border-r`/`border-t`/`border-b` rather than a
four-sided ring: a ring composites outward on all sides evenly, which
reads wrong on a panel attached to one screen edge. This is the same
choice the Copilot panel already made for its own docked edge
(`border-l border-border` in `components/shell/copilot-panel.tsx`), not a
new pattern. Always give a `Sheet` its own `SheetTitle` (and
`SheetDescription` naming the object it's about); a title-less Sheet is
invisible to screen readers even though it reads fine on screen.

## 5. Density per template

Four page templates (`components/shell/*-page.tsx`), one shared
`PageHeader` anatomy (sidebar trigger, title, one-line description, primary
action, Copilot toggle), one shared content rhythm (`gap-6 p-6`). Only the
max-width and the presence of a `band`/`rail` slot differ:

| Template | Max width | Density intent | Routes |
|---|---|---|---|
| `DashboardPage` | `max-w-6xl` | Loosest: a five-second glance, not a document. Generous gaps between stat tiles and queue sections | `/home`, `/strategy` |
| `WorkspacePage` | `max-w-[1600px]` | Densest: board/list layouts need room for many small cards or table rows at once | `/opportunities`, `/sources`, `/cvs`, `/track-record`, `/proof` |
| `DetailPage` | `max-w-5xl` | Reading density: a primary column plus an optional `w-72` support rail, tuned for long-form content (role summaries, profile sections) | `/opportunities/[id]`, `/cvs/[id]`, `/profile` |
| `PlannerPage` | `max-w-6xl` | Section-stacked reading density, same width as Dashboard but built for longer forward-looking content (goals, skills, planner stages) | `/planner`, `/roadmap`, `/goals`, `/skills`, `/rewind` |

A page never hand-builds its own header, padding, or max-width. If a new
surface doesn't fit one of these four shapes, that is a signal to extend a
template, not to freehand a fifth layout.

## 6. State language

One vocabulary for interactive state, applied the same way regardless of
which component carries it:

| State | Treatment |
|---|---|
| Hover (navigable card) | `ring-foreground/20` (up from the resting `/8`) plus `bg-accent/40`; no scale, no shadow pop |
| Hover (list row / menu item) | `bg-accent` background tint only |
| Selected / current | `bg-primary` (or `bg-secondary` for a quieter selected tab/toggle), text flips to the matching `-foreground` token |
| Focus (keyboard) | `ring-[3px] ring-ring/50` plus a solid `border-ring` edge on the control itself, from the shared `focus-visible` utilities on every primitive; never removed, never replaced with only a color change |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` on the control; the label text stays the same color, only opacity drops, so a disabled control is still legible in a screenshot |
| Loading | `Skeleton` (`bg-muted animate-pulse`) for structural placeholders; `Spinner`/`Loader2Icon` with `animate-spin` for an in-place action (approve/save button mid-flight); a scripted "thinking" delay (600 to 1200ms per `docs/architecture.md` section 8) before AI output appears, never an instant swap |
| Empty | `EmptyState`: one line of guidance plus the action that fills it, dashed `border` + `border-dashed` + `bg-muted/30`, centered. Never a blank section with no explanation |

## 7. Icon rules

- Lucide only (`lucide-react`), no second icon set, no inline SVGs hand-drawn for something Lucide already has.
- One stroke weight: Lucide's default (2), never a custom `strokeWidth` override anywhere in the app. Consistent grep-verified as of this pass.
- Size by context, from the sizes already in use:
  - `size-3` inside a chip, next to an 11-12px label
  - `size-3.5` inline next to body/meta text, in compact list rows
  - `size-4` in buttons and page-header controls (the default "control" size)
  - `size-5`/`size-6` in empty-state icons, larger standalone glyphs
  - `size-7`/`size-8` in avatar-adjacent or hero-band icon treatments
- No decorative icons: every icon either labels a control (paired with visible or `sr-only` text), carries chip/status semantics (a chip's dot or `Gauge`/`Sparkles`), or marks a genuinely distinct row kind (an activity timeline's kind icon, a nudge's trigger icon). An icon that exists purely because a card "felt bare" gets removed, not added.

## 8. What this pass changed

See `docs/lessons.md`'s RDS-984 entry for the full UX-law review. In brief:
consolidated the chip tone strings into `chip-tones.ts`, moved
`SkillLevelMeter` off indigo onto `--primary`, fixed a missing `min-w-0`
truncation bug on `TrackRecordEntryCard`'s title row (same class of bug as
lessons.md #22), and swept spacing/hierarchy/emphasis drift across every
route per the checklist above.
