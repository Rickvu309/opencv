# Motion

When and how things move. Calm is the requirement: motion only communicates change — something arrived, something left, something heard you. Nothing bounces, nothing loops, nothing celebrates. Vocabulary follows [animations.dev/vocabulary](https://animations.dev/vocabulary); micro-interaction reference implementations live at [interactionkit.org](https://interactionkit.org/). Tokens ride on [tokens.md](tokens.md).

## The gate

Before anything animates, it passes the frequency gate, in order:

| Frequency | Decision |
|---|---|
| 100+ times a day (thread switching, keyboard-driven actions) | **Never animates.** |
| Tens of times a day (hovers, list navigation, filters) | Near-imperceptible or nothing |
| Occasional (drawer, dock sheet, dialogs, toasts) | Standard animation from the tokens below |
| Rare / first-time (onboarding payback moment) | The only place any warmth is allowed, and still no bounce |

Then it must name a purpose: **feedback**, **spatial consistency**, **state indication**, or **preventing a jarring change**. "It looks nice" is a reason to stop. Data the user is reading never moves for style.

## Tokens

| Token | Value | Used for |
|---|---|---|
| `--duration-fast` | 120ms | Press feedback, hover fills, crossfades |
| `--duration-base` | 200ms | Drawer, sheets, dialogs, dropdowns, toasts |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Everything entering or exiting — the default |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | The drawer and the dock sheet |
| Press | `transform: scale(0.97)` at `--duration-fast` | Buttons and pressable cards |

Rules that never bend:

- **`ease-in` never appears on UI.** Built-in weak easings don't either; the two curves above are the palette.
- **`transform` and `opacity` only.** Never width, height, margin, top, or left (accordion height is the one tolerated exception, and we have no accordion).
- **Never `transition: all`** — name the exact properties.
- **Never `scale(0)`.** Entrances start at `scale(0.97)` + `opacity: 0`; nothing appears from nothing.
- **Transitions, not keyframes, for anything a user can trigger twice in a second** (toasts, toggles) — transitions retarget mid-flight, keyframes restart.
- **Exit the way it entered.** The sheet that slides up leaves through the bottom.
- Popovers and menus scale from their trigger (`transform-origin` at the trigger); centered modals are exempt.
- Hover motion sits behind `@media (hover: hover) and (pointer: fine)`.
- Icon swaps **crossfade**: entering icon scale 0.25→1, opacity 0→1, blur 4px→0; the exiting one reverses. Never a hard swap on a control the eye is on.
- Disable all transitions during a theme switch (relevant the day dark mode lands).
- `will-change` only on properties actually animating, only while they animate.

## Surface inventory

Every animated thing in the app. Anything not on this list does not move; adding a row to this table is how something earns motion.

| Surface | Pattern (vocabulary) | Trigger | Properties | Timing | Interrupt / exit | Reduced motion |
|---|---|---|---|---|---|---|
| Drawer (rail on mobile) | Slide in | Menu button | `transform: translateX` | 200ms `--ease-drawer` | Interruptible transition; exits left | Fade only, 120ms |
| Dock sheet (mobile) | Slide in | Coach button | `transform: translateY(100%)`→0 | 200ms `--ease-drawer` | Interruptible; exits down | Fade only, 120ms |
| Dock panel (desktop) | Fade + scale in | Coach button | `opacity`, `scale(0.97)`→1, origin bottom-right | 120ms `--ease-out` | Transition; fades out | Instant |
| Dialog / confirm | Fade + scale in | Open | Scrim `opacity`; panel `opacity` + `scale(0.97)`→1 | 200ms `--ease-out` | Esc/scrim close fades out | Opacity only |
| Dropdown menu | Scale in from trigger | `···` or account | `opacity` + `scale(0.97)`→1, origin at trigger | 120ms `--ease-out` | Closes instantly | Instant |
| Toast (Sonner) | Slide in + swipe to dismiss | Command ran | Sonner's own transform/opacity | Sonner defaults | Swipe exits the way it points | Sonner honors it natively |
| Button / pressable card | Press feedback | `:active` | `scale(0.97)` | 120ms `--ease-out` | Transition retargets | Keep — it's sub-perceptual feedback |
| Skeleton | Pulse | Loading | `opacity` loop | 2s linear alternate | Replaced by content, no exit | Static `--surface-2`, no pulse |
| Streamed Coach reply | Typewriter (text appends) | Tokens arrive | Text content, no motion styles | — | Stream stops; text stays | Same — appending text is content, not motion; no cursor blink |
| Undo row restore | Fade in | Undo tapped | `opacity` 0→1 | 120ms `--ease-out` | — | Instant |
| Focus ring | — | Focus | **Never animated** | — | — | — |

## The never list

- Thread switching and anything keyboard-initiated — the 100+/day tier.
- Filter pills, tab-like toggles, hover color changes in lists — high-frequency, instant.
- Route changes. No page transitions; the band appearing in place is the orientation.
- Numbers counting up. Completeness reads "42 of 100" instantly, `tabular-nums` and done.
- Layout shift as content loads — skeletons hold the exact slot.
- Confetti, progress celebrations, mascot movement, parallax, scroll-driven anything.
- Autoplaying loops of any kind beyond the skeleton pulse.

## Reduced motion

`prefers-reduced-motion: reduce` means fewer and gentler, not broken: transform-based movement (slides, scales) drops to opacity-only or instant, the skeleton stops pulsing and sits at static `--surface-2`, and the typing indicator becomes a static "Coach is replying" line. Feedback that aids comprehension (a toast appearing, a dialog opening) keeps a plain fade.

**Code today:** per-surface gentler variants as specced in the inventory.

## Adding motion

Follow the animate skill's order — should it move at all (the gate), what purpose, cheapest tool (CSS transition first; a library only for springs or layout animation, which nothing here needs), properties (transform/opacity), curve and duration (the tokens), interruption, exit, reduced motion. Then add the row to the inventory in the same PR. If the new thing is really a component (a toast, a menu), it comes from the established primitive, not a hand-rolled div.
