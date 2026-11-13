---
name: verify-ui
description: Verify your own OpenCV screen change with no reviewer. See any screen in a known state, check it against the pen design, and show the change as red numbered arrows in before and after pictures. Use for any change under apps/web or packages/ui.
---

# Verify UI

Last confirmed against `origin/main` at `89c3703c` on 2026-11-13: every command below was run on a worktree of that commit and printed what this file says.

## When this file is stale

Run `git log --oneline 89c3703c..origin/main -- scripts/ui scripts/ui.mjs .agents/skills/verify-ui` before you start. When it prints commits, run `node scripts/ui.mjs help`: the usage lines there are the truth. If a step here fails or prints something else, follow `help`, then fix this file in the same PR and move the commit above. Never trust a list in prose over a command that prints it.

## I changed a screen: the self-verify path

No reviewer reads every PR. This path is your review. Run it in your worktree, in order, and keep each output. Only one `up` session may run per worktree (and at most one on the machine at a time): a second `up` reuses the first.

| Step | Command                                                                                                              | Takes                                    | Expect                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | `node scripts/ui.mjs up`                                                                                             | 1 to 2 min                               | one JSON line with `web`, `api`, `email`                                                                       |
| 2    | `node scripts/ui.mjs screens`                                                                                        | 1 s                                      | one JSON line per screen with `steps` or `unreachable`, and `designRows`                                       |
| 3    | `node scripts/ui.mjs shot <screen...> --width 1440,390`                                                              | about 10 s per screen                    | one JSON line per PNG                                                                                          |
| 4    | `node scripts/ui.mjs compare <screen...> --width 1440,390 --out ~/tmp/ui/<issue>`                                    | about 2 min for one screen at two widths | one line per capture, then `{"manifest":...,"problems":[]}`                                                    |
| 5    | `node scripts/ui.mjs changes --manifest ~/tmp/ui/<issue>/manifest.json --spec ~/tmp/ui/<issue>/spec.json`            | under 1 s                                | one line per capture with `changes`, `added`, `removed`, then `{"spec":...}`                                   |
| 6    | `node scripts/ui.mjs annotate --spec ~/tmp/ui/<issue>/spec.json --out ~/tmp/ui/<issue>/annotated.png`                | about 1 s per section                    | one line per section with `missing`, `crowded`, `marks`, then `{"out":...}`                                    |
| 7    | `node scripts/ui.mjs check <screen> --known ~/tmp/ui/<issue>/manifest.json --annotate ~/tmp/ui/<issue>/check`        | about 6 s per screen                     | the table, `new since main: ...`, one JSON result; with failures also `{"annotated":".../<screen>-check.png"}` |
| 8    | look, then annotate one image of anything you judged by eye (below)                                                  | 1 s                                      | `{"out":...}`                                                                                                  |
| 9    | `node scripts/ui.mjs pr-section --annotated <png,...> --manifest ~/tmp/ui/<issue>/manifest.json --check --issue <n>` | about 30 s                               | the `## Before / after` markdown                                                                               |
| 10   | `node scripts/ui.mjs down`                                                                                           | a few s                                  | the app and the throwaway database are gone                                                                    |

Pick the screens for steps 3 to 7 from `screens`: every screen whose route or steps reach the file you changed, and every state of it you touched (open and closed panel, empty and full list, waiting and settled Coach). A state no recipe reaches is a gap: add a recipe (see Add a screen) or say so in the PR.

If you touched `packages/ui` (buttons, menus, dialogs, toasts), also shoot one screen that opens a dialog at every size in this grid: `--width 1440,1024,820,390`. A dialog must keep its close button pinned and inside the window at each width.

After step 5, open the spec and only trim or reword: drop a callout that is noise, and rewrite a note into plain words with both values ("Card corners 12px to 8px"). Do not type coordinates by hand when a selector exists.

After step 6 and step 7, open every PNG with your image reader before you hand back. Say in the PR what you saw. A picture you did not look at is not evidence.

What to look at by eye, because no command checks it: colours, type weight and shadows (`check` compares geometry only), copy and hierarchy, focus rings, text that wraps or is cut off, and anything at 390 (the pen file draws no phone frames). For each defect or doubt, write a single-image spec and annotate it so a reader sees it without reading coordinates:

```json
{
  "manifest": "manifest.json",
  "sections": [
    {
      "title": "Paper home at 390: New button",
      "screen": "paper-home",
      "width": 390,
      "side": "after",
      "callouts": [
        {
          "n": 1,
          "note": "New button is 74x44px",
          "target": { "selector": "[data-slot=\"button\"] >> nth=1" }
        }
      ]
    }
  ]
}
```

A single image can also be any PNG: `"image": "shot.png"` with targets `{ "x": 10, "y": 20, "width": 120, "height": 32 }` in that image's pixels.

## What the tool cannot verify

Report these as not verified instead of claiming them:

- Real phones: touch, the on-screen keyboard, browser chrome, safe areas, scroll bounce. Name the screen that needs a real phone.
- Real keyboards beyond what a recipe presses: shortcuts across browsers, IME input.
- Motion: shots stop animations. Easing, duration and jank need a person or a recording.
- Taste: whether the screen reads well. Look at the pictures.
- Fonts on other machines: shots use this machine's fonts (Linux renders).
- The live Coach: `up` runs the fake Coach. `screens` lists what it cannot reach and why.
- Screens with `designRows: 0` in `screens`: `check` refuses them with `no design rows for ...`. Compare them by eye with the nearest composed screen and say so.

## Motion I changed

Motion has one source: the tokens in `packages/ui/src/styles/globals.css` (`--duration-micro` 150ms with `--ease-micro` for hovers, presses and small popups; `--duration-panel` 280ms with `--ease-panel` for panels, sheets and drawers; `--motion-enter-scale` 0.97, `--motion-press-scale` 0.97 and `--motion-press-scale-soft` 0.98). A bare `transition-colors` or `transition-opacity` already runs on the micro token.

1. Use a utility from `packages/ui/src/styles/motion.css` before writing a transition: `motion-pop` for a popover, menu, select or tooltip (it scales from `--transform-origin`), `motion-modal` and `motion-backdrop` for a dialog, `motion-sheet-start` or `motion-sheet-end` for a drawer (it leaves faster than it enters), `motion-press` or `motion-press-soft` for something pressed, `motion-collapse` for a Collapsible panel, `motion-appear` for a list item entering. In script, read timings with `motionToken` or `travelToken` and let a list item leave with `motionLeave` from `@workspace/ui/lib/motion`. Animate transform and opacity only; never animate a keyboard shortcut or the command palette.
2. Run the guard: `node --test scripts/motion-tokens.test.mjs`. It fails on a literal duration or curve, a plain `ease` or `linear`, `transition-all`, tw-animate `animate-in` or `animate-out`, and a transition on a layout property, in CSS, class strings, arbitrary values, style objects, CSS variables and `element.animate` options. When you fix a file on its known list, lower that file's count in `scripts/motion-tokens.ratchet.json`; the list only shrinks.
3. Capture the interaction, since `shot` stops motion. With `up` running, open the screen in a browser driven by script (Playwright from the repo's `playwright-core`, or the agent-browser skill), trigger the interaction, then pause and step every running animation and transition: `document.getAnimations().forEach((a) => a.pause())`, set `a.currentTime` to 0, half and all of `a.effect.getTiming().duration`, and take a screenshot at each. Do the same for the close. Capture main the same way from the base checkout `compare` makes, and put both sequences in the pull request.
4. Check reduced motion. Emulate it (`page.emulateMedia({ reducedMotion: "reduce" })`, or the Rendering panel in DevTools) and repeat step 3. Nothing may move, scale or slide; fades and colour changes stay. Read `getComputedStyle(element).transitionProperty` on the moving element: under reduced motion it lists only opacity and colours.
5. Say what a capture cannot judge: feel at full speed, a real phone and a 120 Hz screen.

## Rule

The pen frame wins. The look, sizes and placement come from the pen design file, which was cloned from Linear. An audit, AI Elements or a component default never overrides a pen frame. When they disagree, follow the frame and report the disagreement.

One owner exception, decided 2026-11-12: the Paper writing page sheet is sized like a real Word page, 816px wide with 96px margins, not the 560px pen frame. The design map holds it as an `ownerDecision` (`scripts/ui/owner-decision.mjs`); `check` prints one line per decided value with the pen value beside it. Add a new exception only on an owner's word, with its reason and date.

When a kit specimen and a composed screen frame disagree, the composed screen frame wins. A failing row means the screen and the mapped frame disagree. Before changing anything:

1. Run `node scripts/ui.mjs frame <id>` for the row's frame and read the pen path that `check` printed under the table.
2. If the path does not start at the composed screen, the row maps a specimen. Fix the row in `scripts/ui/design-map.mjs`.
3. Otherwise fix the screen, not the mapping.

## Commands in detail

- `up` starts a throwaway app for the worktree: pglite database, fake Coach, Word pages on, a signed-in test account, and a background account pool (`pool/filler.log`) that recipes take from. State, logs and shots live in `~/tmp/ocv-ui/<worktree>/`. It never uses `.env` secrets or a real database.
- `shot` writes `<screen>-<width>.png` with fonts loaded and motion stopped.
- `measure <screen> --slot <name>` or `--selector <css>` prints box, radius, padding, gap, type and colours. Without either it lists the `data-slot`s on the screen, capped at 40.
- `frame <id or name>` prints one pen frame with its `path`. The pen file comes from `--pen`, then `OCV_PEN`, then `~/tmp/opencv-ui/opencv.pen`; when it is missing the command prints the `git show` line that fetches it.
- `check <screen...>` compares each design-map row for the screen with its pen frame at 1440 by 900 and exits 1 on any difference over `--tolerance` (default 1px). `--known <manifest.json>` from `compare` splits failures into `new since main`, `changed since main` and `already failing on main`; report only new ones as yours. When the manifest's base is not this branch's merge-base it says `known drift: ... rerun compare`. `--annotate <dir>` writes, per failing screen, `<screen>-check.png`: the screen with a red numbered arrow at each failing element (new failures first, at most 12 arrows; the rest and anything below the first screen go in the legend as text), each legend line reading `<element>: <property> expected X, measured Y, source pen frame <id>`.
- `check --all` checks every reachable mapped screen and prints one line per screen and a total. On 2026-11-13 it checked 15 screens and 309 properties in 272 seconds; give it a 400-second time limit and run it alone. It is the ui tool's own check, not the delivery tool's `check --all`, which you never run on this machine.
- `diff <before.png> <after.png>` counts changed pixels and writes a red diff image.
- `down` stops both servers and deletes the throwaway database. Always run it.

## Before and after for a pull request

A PR that edits screen files (tsx or css under `apps/web/src/features`, `apps/web/src/components` or `packages/ui/src`, tests excluded) carries a `## Before / after` section; `finish` refuses it otherwise (rule `NO_BEFORE_AFTER`). The usual path is steps 4, 5, 6 and 9 above: `compare`, `changes --spec`, `annotate`, `pr-section`.

- `compare` builds the base (`--base`, default `origin/main`) in a throwaway checkout under `~/tmp/ocv-ui/bases/`, captures each screen there and here with the same steps, and writes `<screen>-<width>.before.png`, `.after.png` and `manifest.json` with every `data-slot` box and style and the base `check` results. It is safe to run in parallel; clear copies left by crashed runs with `node scripts/ui.mjs prune-bases`.
- `changes --spec` writes a ready spec: per image, the 6 largest findings (changed elements by size of change, plus elements that are new or removed, a new or removed child of a new or removed element left out) as numbered callouts, and the rest under `also`, which the legend prints as text.
- `annotate` draws one dark composite per screen: a title, `Before (main)` and `After (this PR)` (rename with `"labels": { "before": "...", "after": "..." }`), and per callout a solid red arrow (`#e11d2e`, thin white outline) whose tip touches the element's edge, with a red badge and white bold number at its tail. The same number points at the same element in both images. Badges stay inside the image, off their own and every other marked element, off each other, and arrows do not cross when a non-crossing placement exists. A target named on one side only (`{ "after": {...} }`) is tagged `new` (or `removed`) in the legend and drawn on the other side as a dashed red box at the place it would be. Small changes get 3x crops beside their legend line. Sizes are set so a badge reads 26px wide and its number 14px after GitHub fits the image to its 880px column, the same for a 390 phone shot and a 1440 desktop shot. More than two sections write one composite per section; `--single` keeps one. At most 25 callouts per section.
- `pr-section` uploads the composites in the order given and every capture through `scripts/ocv-tools.mjs shot` and prints the markdown: composites, the `| main | this PR |` table and, with `--check`, the check result per screen.

Write `No visible change.` with one sentence of reason only when `changes` lists nothing for a PR that still edits a screen file, and keep the pictures that show it. A PR that edits no screen file writes `No visible change.` and the reason.

## Add a screen

Add one entry to `SCREENS` in `scripts/ui/screens.mjs`: a kebab-case `id`, the `route`, and `steps` from `goto`, `click`, `fill`, `press`, `type`, `upload` and `waitFor`. Targets are `{ selector }`, `{ role, name }`, `{ text }` or `{ label }`. `upload` sets a file input to a file in `scripts/ui/fixtures`. End with a `waitFor` on what proves the state. Set `signedIn: false` for signed-out screens. If the fake Coach or the local app cannot reach the state, write `unreachable` with the exact reason. Never fake a screenshot. Every recipe takes a new empty account from the pool, so it starts from the same state however often it runs; when the pool is empty a recipe prints `account pool is empty` and waits (sign-in allows three a minute). A screen that ends with a Coach edit waiting must list `after` steps that Deny it. Do not hard-code the sidebar's items in a recipe; click by role and name, since the items come from `apps/web/src/lib/product-paths.ts`. `node --test scripts/ui/screens.test.mjs` validates the table.

## Add a design row

Add one row to `DESIGN_MAP` in `scripts/ui/design-map.mjs`: the `screen`, a `label`, the `selector` (prefer `[data-slot="..."]`), the `composedScreen`, the pen `frame` id and the `props` from `width`, `height`, `x`, `y`, `radius`, the four paddings, `gap`, `fontSize`, `pitch`, `left`, `below` and `centerOffset`.

1. Find the composed screen that draws the state. Run `node scripts/ui.mjs frame "<name or id>"` and keep the match whose `path` starts at it.
2. Run `node scripts/ui.mjs measure <screen>` to find the rendered element, and set `composedScreen`.
3. Run `node scripts/ui.mjs check <screen>`. A `missing` row means the selector found nothing; fix the selector, not the numbers.

`left`, `below` and `centerOffset` need a `from` selector. For a part of a master set `via` to the placed instance ids from the outside in. A same-box row (`kind: "same-box"`, `against` another screen) checks that an element does not move between two screens.

## Checks and guards

List the enforced checks with `node scripts/list-checks.mjs`, not from memory. The tests of this tool are `scripts/ui/*.test.mjs`; run the ones for files you touched, one at a time, with `node --test <file>`.
