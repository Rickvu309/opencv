# Spec 6 — Design system

**Status:** Ready for ticket breakdown
**Related:** ADR-0008 (tokens + governance), ADR-0002 (absorb rule — extended, not replaced), audit `docs/research/2026-08-26-design-system-audit.md`

## Problem Statement

The kit is good and mostly unused. Two-thirds of buttons and four-fifths of inputs bypass it; there is no card, form, or feedback layer, so every surface hand-rolls panels, empty states, focus rings, and "coming soon" affordances its own way — eight empty-state shapes, five focus treatments, four coming-soon patterns, three home-made popovers without focus management. There are no typography, motion, shadow, or status-color tokens, so 90 arbitrary pixel sizes and an Apply stage ramp rendered in five identical greys fill the vacuum. Half the kit stylesheet is Paper-only CSS. For a product whose voice is calm, grounded consistency, the interface currently improvises.

For the agent fleet this is compounding debt: every new feature copies the nearest improvisation, and nothing mechanical stops it.

## Solution

Three moves, in order:

1. **Finish the kit** — the tokens the audit found missing (type scale + display serif, status colors + meaningful chart ramp + one Pitch tone table, motion/shadow/z, reduced-motion), the components every surface already needs (card, form layer, popover, feedback layer), package hygiene (Paper CSS out, focus ring in), and Storybook that builds in CI with token documentation.
2. **Migrate everything** — one ordered sweep replacing hand-rolled buttons, inputs, popovers, panels, empty states, focus rings, tone maps, and pixel sizes with the kit vocabulary, feature by feature.
3. **Lock the vocabulary** — tests that forbid raw hex and palette classes outside two documented exceptions, contract tests that scale automatically, and ADR-0002 updated so every future agent inherits the rules.

Identity decisions locked (ADR-0008): monochrome stays, status hues arrive, dark mode parks (light-only; the secret hotkey goes).

## User Stories

1. As a **User**, I want every screen to feel like one product, so that the calm the Coach projects is what the interface delivers.
2. As a **User**, I want the Apply stage colors to mean something, so that the board reads at a glance.
3. As a **keyboard User**, I want every interactive element to show focus the same way, so that I always know where I am.
4. As a **User with reduced-motion needs**, I want animations to respect my system setting, so that the story viewer doesn't auto-advance on me.
5. As an **agent building a feature**, I want the kit to have the component I need, so that hand-rolling is the exception that gets caught, not the norm that accumulates.
6. As an **agent reviewing a PR**, I want vocabulary violations to fail CI, so that drift is impossible rather than impolite.
7. As the **owner**, I want Storybook to be the visible source of truth — tokens documented, components rendered, built on every PR.

## Ticket breakdown

Three tickets under one parent (owner's sizing call; DS-2's size is an accepted tradeoff — if the sweep stalls, the remainder splits then):

- **DS-1 — The kit**: tokens + components + hygiene + Storybook/CI. Starts immediately (touches `packages/ui` and app-level CSS only).
- **DS-2 — The migration**: full consumption sweep as an ordered per-feature checklist (shared blocks → shell/home → Paper → Apply → Pitch). Blocked by DS-1 **and QVE-136** (Spec 5 verification — the Coach surfaces don't get restyled before they're verified).
- **DS-3 — The lock**: vocabulary tests, contract auto-scaling, ADR cross-links, follow-up filing. Blocked by DS-2.

## Definition of done

- [ ] All ADR-0008 tokens exist and are documented in Storybook Foundations pages
- [ ] Kit ships the eleven new components, each with a story (auto-enforced)
- [ ] Storybook builds in CI; a broken story fails the PR
- [ ] Zero raw `<button>`/`<input>`/`<textarea>`/`<select>` in app features outside documented exceptions; one focus treatment everywhere
- [ ] Zero raw hex / named palette classes outside the two documented exceptions — enforced by a test
- [ ] One Pitch tone table; Apply stage dots visually distinct; no arbitrary `text-[Npx]` outside the scale
- [ ] No Paper CSS in the kit stylesheet; A4 height has one source
- [ ] Reduced motion respected; story viewer pauses
- [ ] Dark-mode hotkey removed; light-only recorded; revival ticket filed
- [ ] ADR-0002 updated with the vocabulary rule; audit note marked resolved
