---
name: verify-ui
description: See any OpenCV screen in a known state and check it against the pen design with one command. Use for any change under apps/web or packages/ui.
---

# Verify UI

## When

Use this for every change under `apps/web` or `packages/ui`, before the PR and again after review fixes. A screen nobody looked at is not verified. Typecheck and component tests do not show size, placement or overlap.

## Rule

The pen frame wins. The look, sizes and placement come from the pen design file, which was cloned from Linear. An audit, AI Elements or a component default never overrides a pen frame. AI Elements supply structure, states, accessibility and behavior; the pen frames supply geometry, color, type and placement. When they disagree, follow the frame and report the disagreement. When `ui check` fails, fix the screen, not the mapping, unless the pen file itself changed.

## Run

```sh
node scripts/ui.mjs up
node scripts/ui.mjs screens
node scripts/ui.mjs shot coach-home paper-panel-open --width 1440,390
node scripts/ui.mjs measure paper-panel-open --slot coach-panel
node scripts/ui.mjs frame REfNk
node scripts/ui.mjs check paper-panel-open
node scripts/ui.mjs diff before.png after.png
node scripts/ui.mjs down
```

- `up` starts a throwaway app for the current worktree: pglite database, fake Coach, Word pages on, and a signed-in test account. State, logs and shots live in `~/tmp/ocv-ui/<worktree>/`. It never uses `.env` secrets or a real database. A second `up` reuses the running app. It builds `packages/domain/dist` first when it is missing.
- `shot` writes `<screen>-<width>.png` (or `@2x` with `--scale 2`) with fonts loaded and motion stopped, and prints one JSON line per file. Upload them to a PR with `node scripts/ocv-tools.mjs shot <files> --pr <n>`.
- `measure` prints box, radius, padding, gap, font size, line height and colors for `--slot` names or `--selector` CSS. Without either it lists every `data-slot` on the screen, capped at 40.
- `frame` prints one pen frame by id or name. The pen file comes from `--pen`, then `OCV_PEN`, then `~/tmp/opencv-ui/opencv.pen`. When it is missing, the command prints the `git show` line that fetches it from the design branch.
- `check` measures each row of `scripts/ui/design-map.mjs` for the screen and prints design, rendered and difference per property. It exits 1 on any difference over `--tolerance` (default 1px) or a missing element.
- `diff` counts changed pixels between two PNGs and writes a red diff image next to the second one.
- Always run `down` when you finish. It stops both servers and deletes the throwaway database.

## Add a screen

Add one entry to `SCREENS` in `scripts/ui/screens.mjs`: a kebab-case `id`, the `route`, and `steps` from `goto`, `click`, `fill`, `press`, `type` and `waitFor`. Targets are `{ selector }`, `{ role, name }`, `{ text }` or `{ label }`. End with a `waitFor` on what proves the state. Set `signedIn: false` for signed-out screens. If the fake Coach or the local app cannot reach the state, write `unreachable` with the exact reason instead of steps. Never fake a screenshot. `node --test scripts/ui/screens.test.mjs` validates the table.

## Add a design row

Add one row to `DESIGN_MAP` in `scripts/ui/design-map.mjs`: the `screen`, a `label`, the `selector` (prefer `[data-slot="..."]`), the pen `frame` id and the `props` to compare from `width`, `height`, `x`, `y`, `radius`, the four paddings and `gap`. Find the frame with `node scripts/ui.mjs frame "<name>"`. Use an instance id when you compare placement, since `x` and `y` come from the instance in the 1440 by 900 app shell.

## What it cannot tell you

- Taste: whether the screen reads well, the hierarchy is clear or the copy is right. Look at the shots.
- Real phones: keyboards, browser chrome, safe areas and touch. Say what still needs a real phone.
- Real fonts on other machines: shots use the fonts on this machine.
- Live Coach behavior: the app runs the fake Coach. States it cannot reach are listed by `screens` with the reason.
- Colors, type and shadows: `check` compares geometry only. Compare colors from `measure` with the frame by hand.
