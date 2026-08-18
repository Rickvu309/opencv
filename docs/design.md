---
version: alpha
name: OpenPath
description: Linear-derived career coach UI. Calm is a functional requirement.
colors:
  canvas: "#fbfbfb"
  surface-1: "#ffffff"
  surface-2: "#f6f6f6"
  surface-3: "#eeeeef"
  hairline: "#e5e5e6"
  ink: "#212226"
  ink-secondary: "#4b4f56"
  ink-muted: "#6f737b"
  ink-faint: "#8a8f98"
  accent: "#5e6ad2"
  accent-hover: "#828fff"
  on-accent: "#ffffff"
  destructive: "#c52828"
  document: "#ffffff"
  document-ink: "#000000"
typography:
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 510
    lineHeight: 1.5
  title-sm:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 510
    lineHeight: 1.5
  title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 510
    lineHeight: 1.4
  title-lg:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 590
    lineHeight: 1.3
  display:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 590
    lineHeight: 1.3
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
rounded:
  control: 6px
  container: 12px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 16px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  nav-item:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: 8px
    height: 44px
  nav-item-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 8px
---

# Design

Tokens above are normative and match `src/styles/globals.css`. Prose says how to apply them. Places and navigation logic live in [flows.md](flows.md) and [features/navigation.md](features/navigation.md), not here.

The full design system — token architecture, layout law, motion law, and component craft — lives in [design-system/](design-system/README.md).

## Overview

The users are anxious about their future. Calm is not taste; it is a functional requirement. Quiet surfaces, generous space, evidence over decoration, one next step always visible.

Brand personality: a good older mentor. Grounded, warm, honest. Encouraging but never flattering. Willing to push back with data. Never hype, never gamified, never corporate-HR.

Voice: second person, contractions fine, sentence case everywhere including headings and buttons. No exclamation marks. Every claim shows its basis; every screen ends with one next step. The full law — mechanics, lexicon, per-surface patterns, banned register — is [copy.md](copy.md). Examples of register: "Start with the CV." "Where is this CV going?" "Log what you're making."

Motion is part of calm, not delight. 120–200ms, ease-out; nothing bounces, nothing loops. Motion only communicates change: a message arriving, a row appearing, an undo landing. Thread clicks in the rail are high-frequency: no animation. Drawer and dock sheet may move. `prefers-reduced-motion` keeps opacity fades that aid comprehension and drops transform-based slides. The full law is [design-system/motion.md](design-system/motion.md).

This product must never look like: career-quiz confetti and gamified badges; enterprise HR dashboards where a person's future is a widget; generic SaaS chrome with hero metrics and identical card grids; cream-beige "AI product" palettes; a chatbot bolted on as a support widget.

## Colors

A surface ladder plus one indigo accent, copied from Linear. The accent appears only on the primary action, focus, links, and active nav — never as decoration.

- **Canvas (`#fbfbfb`):** the shell behind the content panel.
- **Surface-1 (`#ffffff`):** the content panel, cards, inputs, menus.
- **Surface-2 / surface-3 (`#f6f6f6` / `#eeeeef`):** hover and pressed/selected fills.
- **Ink (`#212226`):** body text. Secondary, muted, and faint are the rest of the text ladder.
- **Hairline (`#e5e5e6`):** 1px borders, the first tool for hierarchy.
- **Accent (`#5e6ad2`):** indigo for the one primary action, the focus ring, links, and the active rail item.
- **Destructive (`#c52828`):** delete, and nothing else.

Documents (the A4, the letter) are strictly black on white, independent of app theming. Published Proof pages are the one designed, expressive surface — photos and type allowed — and even there, taste is quiet, not luxury cosplay.

## Typography

Inter Variable with `cv01` and `ss03`, chosen for Vietnamese diacritics and Linear's machined weights. Body is 15px / 1.6. Scale: 12, 13, 15, 18, 24, 32. Weights: 400 (body), 510 (UI emphasis), 590 (headings).

Line height never below 1.3 on headings and 1.5 on body: stacked tone marks (ề, ữ, ộ) must never clip or collide. Test every text style with "Nguyễn Thị Ngọc Ánh" and "trường đại học". Cap body line length at 65–75ch on reading surfaces.

## Layout

A 4px spacing scale. Screens breathe; generous space is part of calm. Touch targets at least 44px. Mobile-first: the reference device is a mid-range Android phone on a slow connection — test there, not on a desktop retina display.

Hierarchy — the four layers, the layout type each screen uses, reading order, primary-action slots, and the empty-states law — is defined in [design-system/layout.md](design-system/layout.md). Tokens stay here; structure lives there.

shadcn/ui primitives live in `src/ui/`, themed by these tokens; no product nouns in primitives.

## Elevation & Depth

Borders first. Shadows only for genuinely floating layers (menus, dialogs, the dock), named `--shadow-overlay`. No stacked cards. No hero metrics that pretend to float.

Focus is `--focus-ring`: 3px accent at 30% opacity. Interactive states must be distinguishable without color alone.

## Shapes

Controls use a 6px radius. Cards, dialogs, and the content panel use 12px. Pills use 9999px. Do not mix a third working radius on the same screen. Documents stay sharp black-on-white rectangles; they do not inherit app rounding.

## Components

- **Buttons.** One primary per screen, on accent. Height 44px. Destructive is the red, and only for delete. Press scales to 0.97; do not animate high-frequency clicks.
- **Rail items.** 44px tall, 13px. Active uses surface-3 fill and accent text, never a decorative bar. Truncate long thread titles; do not wrap the rail.
- **Inputs.** Visible labels. Placeholder is not a label. Error text is a sentence with a next step.
- **Lists.** Flat rows. Type as a word (CV, Resume, Cover letter, Proof, Apply), not an icon that has to be learned.
- **Dock and drawer.** Floating layers: border plus `--shadow-overlay`. Must not cover the artifact's primary action. Esc and the scrim close them.
- **Toasts.** Undo lives here (Sonner). Live regions announce streamed Coach replies and undo.

Numbers and scores always show their working; a bare score is banned UI. Failure states are written, not generic. Anatomy for every template: [design-system/components.md](design-system/components.md).

## Do's and Don'ts

- Do use the accent only for the primary action, focus, links, and active nav.
- Don't decorate with the accent, or use cream/beige/sand as the page background.
- Do keep body text at or above 4.5:1. Don't use muted-gray for body copy.
- Do honour `prefers-reduced-motion` on every animation, including typing indicators.
- Don't animate thread switching or other 100-times-a-day clicks.
- Do write sentence case, second person, no exclamation marks.
- Don't put Profile, Settings, or Proof on the core rail as peers of Chat. Proof lives under Paper. Account is the control. See [flows.md](flows.md).
- Do offer exactly one next step on every empty and error state.
- Don't invent a number, a testimonial, or a readiness the profile does not support.
- Do test Vietnamese diacritics in the account control and every heading.
- Don't use bottom tabs. They would make Coach one of five equals.
- Do keep WCAG 2.1 AA as the floor: keyboard everywhere, skip link, landmarks, honest headings, live regions for the Coach and undo.
