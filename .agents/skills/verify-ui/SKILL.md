---
name: verify-ui
description: Verify your own OpenCV screen change with no reviewer. See any screen in a known state, measure it, sweep it for fit problems and show the change in screenshots. Use for any change under apps/web or packages/ui.
---

# Verify UI

Last confirmed on 2026-11-19 against a worktree of `e22a63892` with the design frames and the compare commands removed: every command below printed what this file says.

## When this file is stale

Run `git log --oneline e22a63892..origin/main -- scripts/ui scripts/ui.mjs .agents/skills/verify-ui` before you start. When it prints commits, run `node scripts/ui.mjs help`: the usage lines there are the truth. If a step here fails or prints something else, follow `help`, then fix this file in the same PR and move the commit above. Never trust a list in prose over a command that prints it.

## I changed a screen: the self-verify path

No reviewer reads every PR. This path is your review. Run it in your worktree, in order, and keep each output. Only one `up` session may run per worktree (and at most one on the machine at a time): a second `up` reuses the first.

| Step | Command                                                 | Takes                 | Expect                                                         |
| ---- | ------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| 1    | `node scripts/ui.mjs up`                                | 1 to 2 min            | one JSON line with `web`, `api`, `email`                       |
| 2    | `node scripts/ui.mjs screens`                           | 1 s                   | one JSON line per screen with `steps` or `unreachable`         |
| 3    | `node scripts/ui.mjs shot <screen...> --width 1440,390` | about 10 s per screen | one JSON line per PNG                                          |
| 4    | `node scripts/ui.mjs measure <screen> --slot <name>`    | a few s               | one JSON line per element with box, radius, padding and colors |
| 5    | `node scripts/ui.mjs sweep screen <screen...>`          | about 1 min a screen  | a summary line per screen, then any failures and HIG lines     |
| 6    | `node scripts/ui.mjs down`                              | a few s               | the app and the throwaway database are gone                    |

Pick the screens for steps 3 to 5 from `screens`: every screen whose route or steps reach the file you changed, and every state of it you touched (open and closed panel, empty and full list, waiting and settled Coach). A state no recipe reaches is a gap: add a recipe (see Add a screen) or say so in the PR.

If you touched `packages/ui` (buttons, menus, dialogs, toasts), also shoot one screen that opens a dialog at every size in this grid: `--width 1440,1024,820,390`. A dialog must keep its close button pinned and inside the window at each width.

Open every PNG with your image reader before you hand back, compare it with the design the owner approved, and say in the PR what you saw. A picture you did not look at is not evidence. Put the screenshots of the changed screens under Evidence.

## What the tool cannot verify

Report these as not verified instead of claiming them:

- Real phones: touch, the on-screen keyboard, browser chrome, safe areas, scroll bounce. Name the screen that needs a real phone.
- Real keyboards beyond what a recipe presses: shortcuts across browsers, IME input.
- Motion: shots stop animations. Easing, duration and jank need a person or a recording.
- Taste: whether the screen reads well. Look at the pictures.
- Fonts on other machines: shots use this machine's fonts (Linux renders).
- The live Coach: `up` runs the fake Coach. `screens` lists what it cannot reach and why.

## Motion I changed

Motion has one source: the tokens in `packages/ui/src/styles/globals.css` (`--duration-micro` 150ms with `--ease-micro` for hovers, presses and small popups; `--duration-panel` 280ms with `--ease-panel` for panels, sheets and drawers; `--motion-enter-scale` 0.97, `--motion-press-scale` 0.97 and `--motion-press-scale-soft` 0.98). A bare `transition-colors` or `transition-opacity` already runs on the micro token.

1. Use a `motion-*` utility from `packages/ui/src/styles/globals.css` before writing a transition: `motion-pop` for a popover, menu, select or tooltip (it scales from `--transform-origin`), `motion-modal` and `motion-backdrop` for a dialog, `motion-sheet-start` or `motion-sheet-end` for a drawer (it leaves faster than it enters), `motion-press` or `motion-press-soft` for something pressed, `motion-collapse` for a Collapsible panel, `motion-appear` for a list item entering. In script, read timings with `motionToken` or `travelToken` and let a list item leave with `motionLeave` from `@workspace/ui/lib/motion`. Animate transform and opacity only; never animate a keyboard shortcut or the command palette.
2. Run the guard: `node --test scripts/motion-tokens.test.mjs`. It fails on a literal duration or curve, a plain `ease` or `linear`, `transition-all`, tw-animate `animate-in` or `animate-out`, and a transition on a layout property, in CSS, class strings, arbitrary values, style objects, CSS variables and `element.animate` options. When you fix a file on its ratchet, lower that file's count in `scripts/motion-tokens.ratchet.json`; the list only shrinks.
3. Capture the interaction, since `shot` stops motion. With `up` running, open the screen in a browser driven by script (Playwright from the repo's `playwright-core`, or the agent-browser skill), trigger the interaction, then pause and step every running animation and transition: `document.getAnimations().forEach((a) => a.pause())`, set `a.currentTime` to 0, half and all of `a.effect.getTiming().duration`, and take a screenshot at each. Do the same for the close. Capture main the same way from a worktree of main when the change replaces existing motion, and put the sequences in the pull request.
4. Check reduced motion. Emulate it (`page.emulateMedia({ reducedMotion: "reduce" })`, or the Rendering panel in DevTools) and repeat step 3. Nothing may move, scale or slide; fades and colour changes stay. Read `getComputedStyle(element).transitionProperty` on the moving element: under reduced motion it lists only opacity and colours.
5. Say what a capture cannot judge: feel at full speed, a real phone and a 120 Hz screen.

## Rule

The design the owner approved wins: a prototype the owner said yes to, or the owner's written direction. An audit, AI Elements or a component default never overrides it. When they disagree, follow the approved design and report the disagreement. Build with its exact colors and sizes; do not bend them to fit an older design without saying so.

## Commands in detail

- `up` starts a throwaway app for the worktree: pglite database, fake Coach, fake mail, a signed-in test account, and a background account pool (`pool/filler.log`) that recipes take from. State, logs and shots live in `~/tmp/ocv-ui/<worktree>/`. It never uses `.env` secrets or a real database.
- `shot` writes `<screen>-<width>.png` with fonts loaded and motion stopped.
- `measure <screen> --slot <name>` or `--selector <css>` prints box, radius, padding, gap, type and colours. Without either it lists the `data-slot`s on the screen, capped at 40.
- `sweep screen <id...> | all | loop` opens screens at ten window sizes and fails on a box that does not fit, a control that cannot be clicked, requests that do not settle, focus lost after Escape or a console error. It reports the Apple interface guideline rules (contrast, 200% text, focus ring, reduced motion) at 1440 and 390 as HIG lines without failing.
- `down` stops both servers and deletes the throwaway database. Always run it.

## Add a screen

Add one file `scripts/ui/screens/<id>.mjs` that exports `screen`: a kebab-case `id` equal to the file name, the `route`, and `steps` from `goto`, `click`, `clickIfShown`, `fill`, `press`, `type`, `upload`, `waitFor`, `respond` and `paperDocs`. Targets are `{ selector }`, `{ role, name }`, `{ text }` or `{ label }`. `upload` sets a file input to a file in `scripts/ui/fixtures`. End with a `waitFor` on what proves the state. Set `signedIn: false` for signed-out screens. If the fake Coach or the local app cannot reach the state, write `unreachable` with the exact reason. Never fake a screenshot. Every recipe takes a new empty account from the pool, so it starts from the same state however often it runs; when the pool is empty a recipe prints `account pool is empty` and waits (sign-in allows three a minute). A screen that ends with a Coach edit waiting must list `after` steps that Deny it. Do not hard-code the sidebar's items in a recipe; click by role and name, since the items come from `apps/web/src/lib/product-paths.ts`. `node --test scripts/ui/screens.test.mjs` validates the table.

## Checks and guards

List the enforced checks with `node scripts/list-checks.mjs`, not from memory. The tests of this tool are `scripts/ui/*.test.mjs`; run the ones for files you touched, one at a time, with `node --test <file>`.
