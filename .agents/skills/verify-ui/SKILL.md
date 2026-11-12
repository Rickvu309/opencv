---
name: verify-ui
description: See any OpenCV screen in a known state and check it against the pen design with one command. Use for any change under apps/web or packages/ui.
---

# Verify UI

## When

Use this for every change under `apps/web` or `packages/ui`, before the PR and again after review fixes. A screen nobody looked at is not verified. Typecheck and component tests do not show size, placement or overlap.

## Rule

The pen frame wins. The look, sizes and placement come from the pen design file, which was cloned from Linear. An audit, AI Elements or a component default never overrides a pen frame. AI Elements supply structure, states, accessibility and behavior; the pen frames supply geometry, color, type and placement. When they disagree, follow the frame and report the disagreement.

The pen file draws some parts twice: once as a kit specimen on a sample sheet, and once inside a composed screen such as `OC App shell`. When a kit specimen and a composed screen frame disagree, the composed screen frame wins. Every row in the design map names its composed screen, and `check` fails a row whose frame is not inside it.

A failing row means the screen and the mapped frame disagree. Before changing anything:

1. Run `node scripts/ui.mjs frame <id>` for the row's frame and read the pen path that `check` printed under the table.
2. If the path does not start at the composed screen, the row maps a specimen. Fix the row in `scripts/ui/design-map.mjs` to the frame inside the composed screen.
3. Otherwise fix the screen, not the mapping.

## Run

```sh
node scripts/ui.mjs up
node scripts/ui.mjs screens
node scripts/ui.mjs shot coach-home paper-panel-open --width 1440,390
node scripts/ui.mjs measure paper-panel-open --slot coach-panel
node scripts/ui.mjs frame REfNk
node scripts/ui.mjs check paper-panel-open
node scripts/ui.mjs check --all
node scripts/ui.mjs diff before.png after.png
node scripts/ui.mjs down
```

- `up` starts a throwaway app for the current worktree: pglite database, fake Coach, Word pages on, and a signed-in test account. State, logs and shots live in `~/tmp/ocv-ui/<worktree>/`. It never uses `.env` secrets or a real database. A second `up` reuses the running app. It builds `packages/domain/dist` first when it is missing.
- `shot` writes `<screen>-<width>.png` (or `@2x` with `--scale 2`) with fonts loaded and motion stopped, and prints one JSON line per file. Upload them to a PR with `node scripts/ocv-tools.mjs shot <files> --pr <n>`.
- `measure` prints box, radius, padding, gap, font size, line height and colors for `--slot` names or `--selector` CSS. Without either it lists every `data-slot` on the screen, capped at 40.
- `frame` prints one pen frame by id or name, with its `path` in the pen file. The pen file comes from `--pen`, then `OCV_PEN`, then `~/tmp/opencv-ui/opencv.pen`. When it is missing, the command prints the `git show` line that fetches it from the design branch.
- `check` measures each row of `scripts/ui/design-map.mjs` for the screen and prints design, rendered and difference per property. For every failing frame row it prints the frame id, its pen path and a reminder to confirm the frame is the composed screen. Same-box rows open a second screen and compare one element's box there. It exits 1 on any difference over `--tolerance` (default 1px), a missing element, or a frame outside the row's composed screen.
- `check --all` runs the rows of every reachable screen in the design map and prints one line per screen (`pass` or `FAIL`, compared, failed) and a total line with the seconds it took. It exits 1 on any failure. `--json` prints one JSON object (`screens`, `compared`, `failed`, `failedScreens`, `seconds`, `ok` and per-screen `failures` with design, rendered and difference) for agents. On 2026-11-12 it checked 8 screens and 164 properties in about 35 to 45 seconds.
- `diff` counts changed pixels between two PNGs and writes a red diff image next to the second one.
- Always run `down` when you finish. It stops both servers and deletes the throwaway database.

## Add a screen

Add one entry to `SCREENS` in `scripts/ui/screens.mjs`: a kebab-case `id`, the `route`, and `steps` from `goto`, `click`, `fill`, `press`, `type`, `upload` and `waitFor`. Targets are `{ selector }`, `{ role, name }`, `{ text }` or `{ label }`. `upload` sets a file input to a file in `scripts/ui/fixtures` (`{ upload: { selector, file } }`); `cv-bold-bullets.docx` is a Word CV with a bold word beside plain text and two bulleted lines. End with a `waitFor` on what proves the state. Set `signedIn: false` for signed-out screens. If the fake Coach or the local app cannot reach the state, write `unreachable` with the exact reason instead of steps. Never fake a screenshot. The fake Coach proposes a Paper edit that waits for approval on a CV made with Use template; on a Start blank Word page it stops instead. A screen that ends with an edit waiting must list `after` steps that Deny it, because a waiting edit keeps Coach busy for the account and every later Coach screen fails with "Coach is already working". If a run stopped midway and left one waiting, run `down` and `up`. `node --test scripts/ui/screens.test.mjs` validates the table.

## Add a design row

Add one row to `DESIGN_MAP` in `scripts/ui/design-map.mjs`: the `screen`, a `label`, the `selector` (prefer `[data-slot="..."]`), the `composedScreen` it belongs to, the pen `frame` id and the `props` to compare from `width`, `height`, `x`, `y`, `radius`, the four paddings, `gap`, `fontSize`, `pitch`, `left`, `below` and `centerOffset`.

From a frame to a row:

1. Find the composed screen that draws the state, such as `W3.5 Coach working`, `W5.2 Paper library`, `W6.4 Editing`, `W9.3 Board`, `W12.1 Preferences` or `W1.1 Continue`. Most of them are instances of `OC App shell` whose main panel is redrawn inside the instance, so their frames have their own ids.
2. Run `node scripts/ui.mjs frame "<name or id>"` and keep the match whose `path` starts at that composed screen. Run it again with the id and read the numbers. An unsized frame reports the height or width its shown children add up to, so a composer drawn as padding, a 40px row, a gap and a 32px row reads 114.
3. Run `node scripts/ui.mjs measure <screen>` or `--selector` to find the rendered element that matches, and set `composedScreen` to the screen name.
4. Run `node scripts/ui.mjs check <screen>`. A `missing` row means the selector found nothing; fix the selector, not the numbers.

`fontSize` reads a text frame. `pitch` is the first child's width plus the gap, compared with the distance between the first two matches of the selector. `left`, `below` and `centerOffset` need a `from` selector: the rendered element's left edge minus the `from` element's left edge, its top minus the `from` element's bottom, and its center minus the `from` element's center. The design numbers come from the frame's parent: its left padding, its gap, and 0 when the parent centers its children. Pick the frame inside the composed screen, never the kit sample sheet: `node scripts/ui.mjs frame "<name>"` lists every match with its pen `path`. For a part of a master, such as the Coach panel body, set `via` to the instance placed in the composed screen (`G8L8J` for the Coach panel). For a part of a master inside another master, list the instances from the outside in, for example `via: ["jsloS", "n4ZOA1"]` for the label of the first sidebar nav item. Use an instance id when you compare placement, since `x` and `y` come from the instance in the 1440 by 900 app shell; a master such as `REfNk` prints `x: null`.

To check that something does not move, add a same-box row: `kind: "same-box"`, the `screen`, the `against` screen, a `label`, the `selector` and the `props`. `check` opens both screens and compares the element's box with the same tolerance. The Coach card rows compare the main content and the writing page on `paper-panel-open` against `paper-panel-closed`.

## No design frame

The pen file has no frame for these screens, so they have no rows and `check` cannot judge them. Do not invent numbers for them; compare with the nearest composed screen by eye and say so in the PR.

- Help.
- The New document dialog.
- Every screen at phone width. The pen file draws only desktop screens (1440 by 900); nothing exists at 390.
- The Coach approval card itself. Its buttons map to the delete confirm dialog `W5.5 Delete confirm` (`I3clp`), the only composed screen with this button pair.

## Before and after for a pull request

A pull request that edits screen files (tsx or css under `apps/web/src/features`, `apps/web/src/components` or `packages/ui/src`, tests excluded) carries a `## Before / after` section. `finish` and the policy check refuse it otherwise (rule `NO_BEFORE_AFTER`). Run four commands in order:

```sh
node scripts/ui.mjs compare paper-panel-open coach-chat-finished --base origin/main
node scripts/ui.mjs changes --spec ~/tmp/ui-spec.json
node scripts/ui.mjs annotate --spec ~/tmp/ui-spec.json --out ~/tmp/ui-annotated.png
node scripts/ui.mjs pr-section --annotated ~/tmp/ui-annotated.png --check
```

- `compare` extracts the base into a throwaway checkout under `~/tmp/ocv-ui/bases/`, installs it, starts it on its own ports, captures each screen, stops it and deletes it, then captures the same screens from this worktree at the same viewport with the same steps. It writes `<screen>-<width>.before.png`, `.after.png` and `manifest.json` with every `data-slot` box and style. A screen that fails on one side is recorded with its reason. It never touches the main checkout.
- `compare` is safe to run in parallel: each worktree gets its own base copy under `~/tmp/ocv-ui/bases/<commit>-<worktree>` and claims its ports, and a run removes only what it made. Clear copies left by crashed runs with `node scripts/ui.mjs prune-bases`.
- `changes` lists up to 8 elements per screen whose box, radius, padding, gap, type, color, background, border or opacity differs, largest first, with a draft note of measured values. `--spec` writes a starting spec with the top 5 per screen.
- `annotate` draws the composite: per section a title, `Before (main)`, `After (this PR)`, numbered pink circles with arrows to the same element in both images, and a legend. Each number takes the first direction in the order up-left, up-right, left, right, down-left, down-right, up, down that keeps its circle inside both images, off its own target, off any other target that does not contain it, and off earlier circles. A target is a `selector` from the manifest or a point `x`, `y` in page pixels.
- Zoom crops: a callout gets a 3x crop from each image beside its legend line, labeled `Before 3x` and `After 3x`, when its two boxes differ by less than 8px in x, y, width and height, or when the element is under 40px wide or tall. The crop is the union of both boxes plus 12px on every side, kept inside the image, and the same rectangle is used on both sides. When that union is larger than 144 by 80, each side instead gets a crop of the same size starting 12px above and left of its own box. A dashed pink outline marks the target in each crop. A zoomed number takes its own legend row.
- One composite per screen: a spec with more than two sections writes one composite per section, named from the section title (`Coach approval, expanded Chat (1440)` becomes `coach-approval-expanded-chat-1440.png`). With `--out dir` the files go in that folder; with `--out name.png` they go beside it as `name-<title>.png`. `--single` keeps one tall composite. Pass the files to `pr-section --annotated a.png,b.png` in the order the reader should see them.
- `pr-section` uploads the composites in the order given and every capture through `scripts/ocv-tools.mjs shot` without a comment and prints the markdown: the composite, the `| main | this PR |` table and, with `--check`, `compared` and `failed` from `check` per screen. Paste it into the body file before `finish`. With `--check`, the section also carries the `check` result for every screen the PR touched, so a reviewer sees whether the screen still matches its frame.

A good callout note says what changed in plain words with both values: "Composer corners 18px to 14px", not "radius tweak". Point at the thing that changed, not near it: if the draft selector is a wrapper the reader cannot see, target the visible element inside it. Keep at most 5 callouts per section, and only claims you measured.

Write the line `No visible change.` under the heading, followed by one sentence of reason, only when `compare` shows identical images or `changes` lists nothing, for example a prop rename or a test-only refactor that still touches a screen file. A small change is still a visible change.

## What it cannot tell you

- Taste: whether the screen reads well, the hierarchy is clear or the copy is right. Look at the shots.
- Real phones: keyboards, browser chrome, safe areas and touch. Say what still needs a real phone.
- Real fonts on other machines: shots use the fonts on this machine.
- Live Coach behavior: the app runs the fake Coach. States it cannot reach are listed by `screens` with the reason.
- Colors, type and shadows: `check` compares geometry only. Compare colors from `measure` with the frame by hand.
