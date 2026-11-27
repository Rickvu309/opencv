---
name: verify-hig
description: Check an OpenCV screen against Apple's Human Interface Guidelines, carried over to the web. Use after any change to a screen under apps/web or packages/ui, before handing back, and when asked whether a screen meets the guidelines. The sweep measures contrast, 200% text, focus rings, reduced motion and target size; the checklist names what to look at in each screenshot.
---

# Verify against the Human Interface Guidelines

Last confirmed on 2026-11-13 against `origin/main` at `33cdfab1` plus the sweep rules added with this skill (issue #1482): every command below was run on Paper home, the Coach page and Settings and printed what this file says.

OpenCV is a web app, not a native Apple app. The rules here are the guideline rules that are about people and screens, carried over as they are or with a named web equivalent. Each one keeps its source page, URL and source wording in `references/`. iOS-only rules are in `references/left-out.md` with the reason.

## When this file is stale

Run `git log --oneline 33cdfab1..origin/main -- scripts/ui/sweep packages/ui/src/lib/hig-rules.ts .agents/skills/verify-hig` first. When it prints commits, run `node scripts/ui.mjs help` and trust its usage lines over this file. If a step fails or prints something else, follow the command, fix this file in the same PR and move the commit above.

The guidelines change too. To reread a page, fetch its Markdown copy with TinyFish Fetch (free): `npx -y @tiny-fish/cli@latest fetch content get https://developer.apple.com/design/human-interface-guidelines/<slug>.md`. The HTML page only says to turn on JavaScript. Never write a rule from memory; quote the page.

## Short path

Run in your worktree, in order. One `up` per machine where you can; `down` when done.

| Step | Command                                             | Takes                | Expect                                                                                                                           |
| ---- | --------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `node scripts/ui.mjs up`                            | 1 to 2 min           | one JSON line with `web`, `api`, `email`                                                                                         |
| 2    | `node scripts/ui.mjs sweep screen <id...>`          | 7 to 11 s per screen | per screen a summary ending `, N HIG findings` when any, then `FAIL` lines and `HIG` lines, then a JSON total with `higFindings` |
| 3    | open the sweep shots, then walk the checklist below |                      | your own findings, each with its screenshot                                                                                      |
| 4    | `node scripts/ui.mjs down`                          | a few s              | the app and its throwaway database are gone                                                                                      |

Pick the screens from `node scripts/ui.mjs screens`: every screen and state your change reaches. `--size 390x844` checks one size. `sweep all` checks every recipe and route.

A `HIG` line reads: screen, size, rule, source page and URL, the count and the first finding with what was measured, the screenshot and the repro. The full list is in `sweep/report.json` under the case's `findings`, and each case has `checked` (how many things it measured).

`HIG` lines do not fail the sweep: the product breaks some of these rules on `main` today. Report the ones your change adds or touches. A finding on a line you did not touch goes under Findings in your report, not into your diff.

## What the machine checks

| Rule                                                                                                                                                                  | Guideline (page)                         | Where                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hig-contrast`: text under 18px and lighter than 700 needs 4.5:1, 18px or bold 3:1, icon-only controls 3:1, measured from rendered colours through translucent layers | Accessibility                            | sweep, 1440 and 390, `packages/ui/src/lib/hig-rules.ts`                                                                                                                                                                                                |
| `hig-text-size`: at 200% browser text size, text that did not grow, a box that newly clips or truncates, a page that newly scrolls sideways                           | Typography, Layout                       | sweep, 1440 and 390                                                                                                                                                                                                                                    |
| `hig-focus-ring`: the first 16 Tab stops each show an outline, ring, border or fill change                                                                            | Accessibility                            | sweep, 1440                                                                                                                                                                                                                                            |
| `hig-reduced-motion`: with reduced motion asked for, no animation repeats forever or moves (progress indicators exempt)                                               | Accessibility, Motion                    | sweep, 1440 and 390                                                                                                                                                                                                                                    |
| `fits`: controls at least 44x44 at 430px and under, nothing off screen or covered, no sideways page                                                                   | Accessibility, Modality                  | sweep, ten sizes                                                                                                                                                                                                                                       |
| `focus`: Escape closes the top layer and focus returns to its opener                                                                                                  | Accessibility, Modality                  | sweep                                                                                                                                                                                                                                                  |
| `requests`: the screen settles                                                                                                                                        | Loading                                  | sweep                                                                                                                                                                                                                                                  |
| class-name targets, dialog fit, dialog Tab trap, kit dialogs, colour tokens, toast place, sidebar items                                                               | Accessibility, Modality, Color, Tab bars | `scripts/touch-targets.test.mjs`, `dialogs-fit-window.test.ts`, `dialogs-trap-tab.test.tsx`, `dialogs-use-kit.test.ts`, `design-vocabulary.test.ts`, `toast-position.test.mjs`, `app-sidebar.test.tsx` (find them with `node scripts/list-checks.mjs`) |

## Checklist by eye

Look at the 1440 and 390 shots and the 200% text shot. Each line: what to look at, and what passing looks like. Full rules and quotes: `references/<area>.md`.

- Accessibility: state never by colour alone, a word or icon too (A3). Two tappable things at 390 at least 12px apart (A8). An action toast stays long enough to reach (A12).
- Color: one colour, one meaning across the screen (C1). Text over images or gradients is legible (C13, the sweep skips it).
- Typography: nothing under 11px, no weight under 400 below 18px (T1, T2). At 200% the title and primary action are still first (T5, T11).
- Layout: edges line up (L2). Every action at 1440 exists at 390 (L10). Fixed bars on phones leave room for the notch and home bar: needs a real phone (L6).
- Icons: one stroke width and size across the screen (I2), stroke weight matches its label (I3).
- Writing: buttons are verbs naming the result (W3), empty states name one next step (W7), errors sit by the field and say the fix (W8), no "the user", no internal words (W11, W12).
- Patterns: one dialog at a time, each titled, each with a visible close (P17, P19, P20). Refusals say why (P5). A reload keeps the place (P24). Undo brings the change into view (P30).
- Components: one filled primary button per view, never destructive (K3, K6). Toggles differ by more than colour and have labels (K25, K26). Disabled menu items stay visible (K19). A popover does not cover its opener (K15).

Judgement rules (reasoned in the PR, not measured) are marked `judgement` in `references/`.

## What this cannot verify

- Real phones: safe areas, the on-screen keyboard, touch slop. Name the screen that needs one.
- Motion feel and timing: shots stop motion. Use a recording; the apple-design skill owns feel.
- The browser text-size setting itself: the sweep doubles the root font size, which is what that setting does unless the page pins it in px. The page does not pin it today (`packages/ui/src/styles/globals.css`).
- Contrast over images and gradients, placeholders, and colour pairs that only appear on hover.
- Focus rings beyond the first 16 Tab stops.

## Rule

The design the owner approved wins for size, look and placement (`.agents/skills/verify-ui/SKILL.md`). When a guideline and that design disagree, follow the design and report the disagreement with the guideline's quote. The guideline wins only where the design does not decide, and for people's access: contrast, text size, focus, motion and targets.

## Change a rule

The pure rules and their sources are `packages/ui/src/lib/hig-rules.ts` (tests: `hig-rules.test.tsx`). The in-page probes are `scripts/ui/sweep/hig-probes.mjs`; the cases and lines are `scripts/ui/sweep/hig.mjs` (tests: `hig.test.mjs`, `runner.test.mjs`). Run those tests one file at a time. Add a rule with its quoted source in `HIG_SOURCES` and a row in `references/`.
