# Design

The users are anxious about their future. Calm is not taste here; it is a functional requirement. Quiet surfaces, generous space, evidence over decoration, one next step always visible.

## Anti-references

What this product must never look like: career-quiz confetti and gamified badges; enterprise HR dashboards where a person's future is a widget; generic SaaS chrome with hero metrics and identical card grids; cream-beige "AI product" palettes; a chatbot bolted on as a support widget.

## Tokens

Defined once in `src/styles/globals.css` as CSS custom properties; Tailwind v4 reads them. Components use semantic tokens, never raw values.

### Color

Monochrome ink-on-paper base, one restrained accent. The accent appears only on the primary action, focus, and active states — never as decoration.

| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | App surface |
| `--foreground` | `#141413` | Ink: body text |
| `--muted` | `#f5f5f4` | Quiet fills: rows, code, wells |
| `--muted-foreground` | `#5c5c58` | Secondary text (4.5:1 on white) |
| `--border` | `#e4e4e1` | Hairlines |
| `--accent` | `#1a5e45` | Deep green: primary action, focus ring, active nav |
| `--accent-foreground` | `#ffffff` | Text on accent |
| `--destructive` | `#9f1d1d` | Delete, and nothing else |

Documents (the A4, the letter) are strictly black on white, independent of app theming. Published Proof pages are the one designed, expressive surface — photos and type allowed — and even there, taste is quiet, not luxury cosplay.

### Type

| Token | Value |
|---|---|
| Family | Be Vietnam Pro, system-ui fallback — chosen for full Vietnamese diacritics |
| Body | 16px / 1.6 |
| Scale | 13, 14, 16, 18, 22, 28, 36 |
| Weights | 400, 500 (UI emphasis), 650 (headings) |

Line height never below 1.5 on Vietnamese text: stacked tone marks (ề, ữ, ộ) must never clip or collide. Test every text style with "Nguyễn Thị Ngọc Ánh" and "trường đại học".

### Space, radius, elevation

- 4px spacing scale; screens breathe — generous space is part of calm.
- Radius: 6px controls, 10px cards and dialogs.
- Elevation: borders first; shadows only for genuinely floating layers (menus, dialogs), soft and small.

### Motion

- 150–250ms, ease-out; nothing bounces, nothing loops.
- Motion only communicates change: a message arriving, a row appearing, an undo landing.
- `prefers-reduced-motion` removes all non-essential motion, including typing indicators and progress fills.

## Voice and copy

The product talks like a good older mentor: encouraging, never flattering, willing to push back with data.

- Second person, contractions fine, sentence case everywhere — including headings and buttons.
- **No exclamation marks.** No startup cheerfulness ("Great question", "You've got this").
- Every claim shows its basis; motivation without evidence is what this product replaces.
- Every screen, empty state, and error ends with one next step.
- Honest about distance: if the goal is far, say so, with a time estimate. Never flatter readiness.
- Type words users see: CV, Resume, Cover letter, Proof, Uploaded. English UI for now.

Empty-state copy is specified per feature spec, in this voice. Examples of register: "Start with the CV." "Where is this CV going?" "Log what you're making."

## Accessibility

WCAG 2.1 AA is the floor, not the target.

- Body text contrast ≥ 4.5:1; interactive states distinguishable without color alone.
- Full keyboard operability everywhere, with the chat composer and the onboarding wizard as the two tested-first paths. Visible focus (accent ring, 2px, offset).
- Skip link, landmarks, and honest headings on every screen; live regions announce streamed Coach replies and undo toasts.
- Touch targets ≥ 44px. Mobile-first: the reference device is a mid-range Android phone on a slow connection — test there, not on a desktop retina display.

## Craft rules

- shadcn/ui primitives in `src/ui/`, themed by tokens; no product nouns in primitives.
- One primary action per screen. If two things compete, one of them is wrong.
- Numbers and scores always show their working; a bare score is banned UI.
- Loading is skeletons in place, never spinners over blank pages. Failure states are written, not generic.
