---
version: alpha
name: OpenPath
description: Ink-on-paper career coach UI. Calm is a functional requirement.
colors:
  background: "#ffffff"
  foreground: "#141413"
  muted: "#f5f5f4"
  muted-foreground: "#5c5c58"
  border: "#e4e4e1"
  accent: "#1a5e45"
  accent-foreground: "#ffffff"
  destructive: "#9f1d1d"
  document: "#ffffff"
  document-ink: "#000000"
typography:
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  heading-sm:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 650
    lineHeight: 1.5
  heading-md:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 650
    lineHeight: 1.5
  heading-lg:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 650
    lineHeight: 1.5
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: 36px
    fontWeight: 650
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
  card: 10px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  nav-item:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: 8px
    height: 44px
  nav-item-active:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 8px
---

# Design

Tokens above are normative and match `src/styles/globals.css`. Prose says how to apply them. Places and navigation logic live in [flows.md](flows.md) and [features/navigation.md](features/navigation.md), not here.

## Overview

The users are anxious about their future. Calm is not taste; it is a functional requirement. Quiet surfaces, generous space, evidence over decoration, one next step always visible.

Brand personality: a good older mentor. Grounded, warm, honest. Encouraging but never flattering. Willing to push back with data. Never hype, never gamified, never corporate-HR.

Voice: second person, contractions fine, sentence case everywhere including headings and buttons. No exclamation marks. Every claim shows its basis; every screen ends with one next step. The full law — mechanics, lexicon, per-surface patterns, banned register — is [copy.md](copy.md). Examples of register: "Start with the CV." "Where is this CV going?" "Log what you're making."

Motion is part of calm, not delight. 150–250ms, ease-out; nothing bounces, nothing loops. Motion only communicates change: a message arriving, a row appearing, an undo landing. Thread clicks in the rail are high-frequency: no animation. Drawer and dock sheet may move. `prefers-reduced-motion` removes all non-essential motion, including typing indicators and progress fills.

This product must never look like: career-quiz confetti and gamified badges; enterprise HR dashboards where a person's future is a widget; generic SaaS chrome with hero metrics and identical card grids; cream-beige "AI product" palettes; a chatbot bolted on as a support widget.

## Colors

Monochrome ink-on-paper base, one restrained accent. The accent appears only on the primary action, focus, and active nav — never as decoration.

- **Foreground (`#141413`):** ink for body text.
- **Background (`#ffffff`):** app surface.
- **Muted (`#f5f5f4`) and muted-foreground (`#5c5c58`):** quiet fills and secondary text. Muted-foreground is at least 4.5:1 on white.
- **Border (`#e4e4e1`):** hairlines, the first tool for hierarchy.
- **Accent (`#1a5e45`):** deep green for the one primary action, the focus ring, and the active rail item.
- **Destructive (`#9f1d1d`):** delete, and nothing else.

Documents (the A4, the letter) are strictly black on white (`document` / `document-ink`), independent of app theming. Published Proof pages are the one designed, expressive surface — photos and type allowed — and even there, taste is quiet, not luxury cosplay.

## Typography

Be Vietnam Pro with a system-ui fallback, chosen for full Vietnamese diacritics. Body is 16px / 1.6. Scale: 13, 14, 16, 18, 22, 28, 36. Weights: 400 (body), 500 (UI emphasis), 650 (headings).

Line height never below 1.5 on Vietnamese text: stacked tone marks (ề, ữ, ộ) must never clip or collide. Test every text style with "Nguyễn Thị Ngọc Ánh" and "trường đại học". Cap body line length at 65–75ch on reading surfaces.

## Layout

A 4px spacing scale. Screens breathe; generous space is part of calm. Touch targets at least 44px. Mobile-first: the reference device is a mid-range Android phone on a slow connection — test there, not on a desktop retina display.

Hierarchy — the four layers, the layout type each screen uses, reading order, primary-action slots, and the empty-states law — is defined in [layout.md](layout.md). Tokens stay here; structure lives there.

shadcn/ui primitives live in `src/ui/`, themed by these tokens; no product nouns in primitives.

## Elevation & Depth

Borders first. Shadows only for genuinely floating layers (menus, dialogs), soft and small. No stacked cards. No hero metrics that pretend to float.

Focus is an accent ring, 2px, offset. Interactive states must be distinguishable without color alone.

## Shapes

Controls use a 6px radius. Cards and dialogs use 10px. Do not mix a third radius on the same screen. Documents stay sharp black-on-white rectangles; they do not inherit app rounding.

## Components

- **Buttons.** One primary per screen, on accent. Height 44px. Destructive is the red, and only for delete. Press should feel instant; do not animate high-frequency clicks.
- **Rail items.** 44px tall. Active uses muted fill and accent text, never a decorative bar. Truncate long thread titles; do not wrap the rail.
- **Inputs.** Visible labels. Placeholder is not a label. Error text is a sentence with a next step.
- **Lists.** Flat rows. Type as a word (CV, Resume, Cover letter, Proof, Apply), not an icon that has to be learned.
- **Dock and drawer.** Floating layers: border plus a small shadow. Must not cover the artifact's primary action. Esc and the scrim close them.
- **Toasts.** Undo lives here. Live regions announce streamed Coach replies and undo.

Numbers and scores always show their working; a bare score is banned UI. Failure states are written, not generic.

## Do's and Don'ts

- Do use the accent only for the primary action, focus, and active nav.
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
