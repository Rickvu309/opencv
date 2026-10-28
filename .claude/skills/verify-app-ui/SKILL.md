---
name: verify-app-ui
description: Check the interior quality and taste of the signed-in OpenCV app (Coach, Paper, Apply, Pitch), covering writing, logic, structure, visual craft, motion, accessibility and performance. A mechanical checker signs up a throwaway account on a PGlite stack and measures its properties in headless Chromium at 1440x900, 390x844 and reduced motion, and a judged rubric scores what a program cannot decide. Use after any change under apps/web/src/features/coach, paper, apply, pitch, app-shell, apps/web/src/routes, or a packages/ui component those import (button, card, dialog, empty, input, kbd, skeleton, spinner, tabs, tooltip, badge), the motion tokens in packages/ui/src/styles/globals.css, and when asked whether the app is good.
---

# verify-app-ui

Two layers. The checker (`scripts/verify-app-ui.mjs`) decides what a program can: words, counts, boxes, computed colors and durations, which control takes focus, what the page shows while a call is held. The rubric (`rubric.md`) decides the rest, and three reviewers from different model families score it. Neither layer replaces the other. A green checker says the app follows the written rules. It does not say the app is good.

All paths are relative to the repo (or worktree) root. The rules come from the APPUI research (30 quality checks, kept outside the repo). Each property below names its source, so you do not need that file. The sister skill `verify-landing` does the same for the marketing page; this one is for the app behind sign-in.

## Run the checker

```bash
PORT=4450 pnpm --filter web verify:app-ui
```

- `PORT` is the api port and `PORT+1` the web port. Use 4450 to 4458 (the ports this program reserves for UI verification); default 4450. If either port answers, it refuses and exits 2 so it never drives a stack it did not start.
- It starts the real api (PGlite, `COACH_RUNTIME=fake`, no network, no tokens) and the Vite dev server by calling `.claude/skills/verify-opencv/scripts/launch.sh` and `cleanup.sh`, and tears both down at the end, also on failure. It builds `packages/domain` first when `dist` is missing (a fresh worktree has none).
- It signs up a throwaway account through the api in the browser, so every run starts with the starter workspace: a sample CV, four Apply cards, a sample Pitch and a welcome Thread.
- Needs `pnpm install` done and a Chromium. It looks for `$CHROME_BIN`, then `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome` (installed by the agent-browser tooling), then `chromium` on the path. No new dependency: it speaks the DevTools protocol over Node's built-in WebSocket.
- About 2 to 4 minutes on a loaded machine (stack start, 4 routes, 8 steps, 4 scenarios, 2 more passes). One browser plus the two servers, so do not run it beside install, vitest or another browser run on the shared machine.
- `VERIFY_APP_UI_SHOTS=<dir>` writes the screenshots the reviewers need (list in `rubric.md`). `VERIFY_APP_UI_DATA=<file>` writes every raw measurement as JSON, which is the way to see what a FAIL measured.

Output is one line per property, `PASS|FAIL|STALE <id> [<kind>] <name>: <measured> | rule: <rule>`, then `N PASS, M FAIL, K STALE: <ids> [tier <tier>]`. A check judges every part it can find. Any found part that breaks the rule makes it FAIL, and the line names the parts it could not judge. With none broken, a part it could not locate (a source folder it scans, a stubbed request that never fired, a surface whose primary button matched nothing) makes it STALE. Otherwise PASS. Exit 0 all PASS, 1 any FAIL and no STALE, 3 any STALE, 2 the stack, the browser or a screen did not work (an error, not a verdict). The pure text and color rules have unit tests: `node --test .claude/skills/verify-app-ui/scripts/lib/text-rules.test.mjs` (no browser, under a second).

What the tour does, in order, signed in at 1440x900: visits every route once to warm the dev server; then for Coach, Paper, Apply and Pitch it loads the route and times it, walks Tab to the primary action, and measures the screen. On Coach it opens Search with Ctrl-K and sends "Review my CV" for a scripted Coach turn. On Paper it opens the sample CV and the Coach float. On Pitch it reads the coming-soon page and does not open a story. Scenario pages follow: `GET /api/paper` held while the page is read, `GET /api/paper` answered with an empty list, the Coach send answered with `404 USER_NOT_FOUND "User not found."`, and the Coach send with the connection refused. A reduced-motion pass and a 390x844 mobile pass visit the four routes again. Last, the tour deletes the four seeded Apply cards through the api (`apply.deleteCard`) and reads the empty board. A step that does not happen (a click finds nothing, a screen never renders, the deletes fail) throws and the run exits 2; it is never a pass. The api answers are the only mocks, apart from the scripted Coach and the stub posting scan that verify-opencv already isolates; say so in a report. The throwaway account is not reused, and the stack and its data are removed at the end.

Reading a STALE: it means the check could not run that part, and the measured value names it ("not judged: ..."). A STALE hides nothing that was found, since any FAIL in the same check would have shown. Decide whether the checker's setup or the app changed. If the app dropped the call or the button on purpose, repair the tour, the probe or `scripts/lib/assumes.mjs` (the folders, routes, stub patterns, selectors and `data-primary-action` markers it lists; `apps/web/src/test/verify-assumptions.test.ts` fails on a push when one no longer matches the app). If the app lost it by accident, that is the regression: fix the app. A check that cannot run never counts as a pass.

Reading a FAIL: the measured value is what the app does, the rule is what it should do. Decide whether the app or the checker is wrong, in this order:

1. Is the measurement right? Read `VERIFY_APP_UI_DATA`, or compare with the screenshot. A number that does not match what you see is a probe bug: fix `scripts/lib/probe.mjs`.
2. Is the rule right? If the measurement is right but the rule misjudges (a good screen fails, or a bad screen passes), fix the rule in `checks.mjs`, `checks-content.mjs` or `text-rules.mjs` and add a case to `text-rules.test.mjs` when it is a pure text rule.
3. Both right: it is a finding about the app. Report it. Do not edit the app unless that was the task.

## Tiers

Each check has one kind, in `scripts/lib/kinds.mjs` and [properties.md](properties.md). An invariant check holds for any good design: WCAG, reduced motion, tokens only, writing rules, no sideways scroll, the render budget. A design check holds only for the current one: a pinned copy line, size, label, theme or surface list (06, 08, 11, 12, 16, 19, 23, 28, 29, 30, 36, 38, 40, 42).

- `VERIFY_TIER=invariant` runs the invariant checks only. The design checks are not computed. The tour still visits every screen and scenario, because invariant checks read its data (10 reads the empty board, the contrast and layout checks read every snapshot, 45 reads every page's scroll width). Only the Paper empty-list scenario, which only design check 29 reads, is run without need. The run takes about as long (163 s measured on the shared machine).
- `VERIFY_TIER=design` reports only the design checks. `VERIFY_TIER=all` (default) runs both.
- `verify:pen-layout` and `verify:apply-pen` are separate commands and design by nature. The tier does not touch them.
- Unlike the landing, this checker has no spec file or recorder yet. After a redesign of the signed-in screens, look at the screenshots (`VERIFY_APP_UI_SHOTS`), then edit the pinned copy in the design checks and re-record the layouts with `scripts/pen-layout.mjs`.

## In the PR review

`scripts/review-pr.sh` runs this checker at `VERIFY_TIER=invariant` for a PR that touches `apps/web/`, `packages/ui/` or a verify skill. `known-findings.json` next to this file lists the invariant FAILs that are allowed, each tracked by an issue: `[{ "id": "20", "issue": 553, "since": "2026-10-29", "note": "..." }]`. The review reads the copy on `main`. A FAIL not listed, a listed check that now passes (delete its entry in the fix PR), a STALE and an exit 2 each fail the review. Add an entry only after the issue exists, on `main` in its own PR.

## Apply against opencv.pen

`PORT=4454 heavy -- pnpm --filter web verify:apply-pen` holds every Apply state to its pen frame. See [apply-pen.md](apply-pen.md).

## The properties

Forty-four named properties (id 14 retired with the Home page and is not reused). Ids 01 to 30 are the research check numbers, 31 to 38 are app-wide checks the signed-in tour adds, 39 to 44 are the design text rules, and 45 is the sideways-scroll check (pinned phrases in `scripts/lib/copy.json`). Each has a rule, a source and a note when it is a heuristic: read [properties.md](properties.md). Search the id in `scripts/lib/checks-content.mjs` (01 to 13) or `scripts/lib/checks-source.mjs` (24 to 27), `scripts/lib/checks-primary.mjs` (28 and 32) or `scripts/lib/checks.mjs` (the rest of 14 to 44).

## Baseline at the sync commit

At `b031ebf3` plus the assumptions change (#531) the checker prints 36 PASS, 7 FAIL and 0 STALE: FAIL 01 20 27 28 30 34 41. 02 passes since #516 left one Coach composer placeholder. 30 FAILs since `2fdcca38` (#522) deleted the unmounted Paper suggestion bar: its "Undo this change" string was the only Reject the source scan found, and no Coach Reject control is mounted. Check 34 (first render within 2000 ms) is load-sensitive on this box and failed in the latest run, at Paper 2270 ms and Coach 2258 ms. 04 now drives its Coach stub (`POST /api/chats/<id>/turns`, one hit in each scenario) and passes. The design pass of 2026-10-28 (#510) judged the design FAILs against the code; each is a finding about the app, not a defect in the checker:

- 20: eight text nodes under 4.5:1, all on the Inbox connect screen, such as "Skip for now" at 3.36:1 and "Reads job emails only. Nothing is sent without you." at 2.45:1. `inbox-parts.tsx` `SOFT_TEXT` (`text-muted-foreground/70`) and `FAINT_TEXT` (`/55`) copy the pen greys #8A8A8E and #A0A0A2, which fail AA on white. Introduced by `682a1ea7` (#505). Apply ships such greys as the lightest AA grey (`apply-tone.ts`); Inbox does not.
- 28: Apply's New job is 28px (`apply-toolbar.tsx` `h-7`, from `aa89ba79`, #509). The pen draws that control (node BmWvu) as a 28px ghost header action, so check 28 and the pen disagree. The operator decides which one moves. Paper New is 32px and Pitch Get early access is 40px.
- 41: the Coach mode picker labels "Light · Pro" and "Max · Pro" carry a middle dot (`coach-dock.tsx` `MODE_SEGMENTS`, from `2c62f760`, #476). The pen labels the segment "Light".

Seen in the #526 run and not judged in the design pass:

- 27: the Paper conflict banner is `role="region"` (`paper-editor-conflict-banner.tsx`, from `7ea61e9c`, #396), not `role="alert"`. The Coach error is in a live region. The banner part is judged even when the Coach stub never fires.
- 32: passes. Coach's primary is the Add control of the composer (`data-primary-action` in `coach-dock.tsx`); Tab reaches it in 15 presses, Paper 13, Apply 12, Pitch 12.
- 36: passes. The Paper library has been a card grid since #396, so the probe's table-row locator found nothing. The probe now reads the Paper cards (`PaperCard`'s open button) and the line counts them.
- 01 stays unjudged.

## Pen layout check

`pnpm --filter web verify:pen-layout` holds each built screen to the text layout of its pen frame. The text parity tests only compare words. This check compares where the words sit. It starts the same stack as the checker (PORT 4450 to 4458, api on PORT, web on PORT+1), signs up a throwaway account and visits every route at 1440x900, dpr 1, reduced motion.

- **Input.** Every `apps/web/src/features/**/design/*.layout.json`. Each file records, for one pen frame, every visible text with its box, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `color` and `textAlign`, relative to the pen's main panel `GIhbq`.
- **What it measures.** The app's `#app-main` panel stands for `GIhbq`. For each pen text it finds the smallest visible element whose own text (whitespace collapsed, `<br />` read as a space) equals the pen text, and measures the text itself, not its box.
- **Tolerances.** Position within 8 px (left edge for left text, centre for centred, right edge for right, top edge for y). `fontSize` within 0.5 px. `fontWeight` exact. `letterSpacing` within 0.3 px. Colour within 0.04 OKLab distance. A missing text fails.
- **Output.** One `FAIL <frameId> <route> "<text>" <property>: pen <v> app <v>` line per mismatch, one `PASS|FAIL` line per layout, then a summary. Exit 0 all match, 1 any mismatch, 2 the stack, browser or a route failed. `VERIFY_PEN_LAYOUT_SHOTS=<dir>` saves a screenshot per route. `VERIFY_PEN_LAYOUT_DATA=<file>` saves the raw app measurements.
- **Add a screen.** Run `node scripts/pen-layout.mjs <pen file> <frame id> apps/web/src/features/<surface>/design/<name>.layout.json --route <path>` (add `--png <file>` to look at the render, `--pane <node id>` when the frame's content panel is not `GIhbq`) and commit the JSON. Never edit a layout by hand. Regenerate it when the pen changes.
- **Exceptions.** `PEN_LAYOUT_EXCEPTIONS` in `scripts/lib/pen-layout-compare.mjs` starts empty. An entry is `{ frameId, text, property, reason, until, approvedBy }`. It hides one property of one text until the `until` date. An expired entry fails, and so does a stale one whose property now matches. An operator approves each entry.
- **Sync commit.** `ceb07502` (main, checked in #510): 2 PASS (RAl5t `/pitch` 22 texts, FCDYX `/proofs` 16 texts), 14 SKIP (the Apply layouts, driven by verify-apply-pen). Covered code: `features/coming-soon` (Pitch and Proof pages), `features/app-shell` (the `#app-main` panel), `scripts/pen-layout.mjs`. Inbox, Coach, Jobs, Paper and Settings have no layout file, so this check does not hold them to the pen.
- **Tests.** `node --test .claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.test.mjs` covers the comparison without a browser. It includes recorded measurements of the old Pitch page, which must fail.

## Taste review (judged layer)

Ten judged items, J1 to J10, each scored 0, 1 or 2 with anchors for 0 and 2. The items, the protocol (three reviewers from different model families, median of 2 passes, any 0 is a finding) and the exact reviewer prompt are in `rubric.md`. Copy the prompt from there; do not paraphrase it. Run the checker with `VERIFY_APP_UI_SHOTS` first; the screenshots are what the reviewers see. Do not show reviewers the checker output.

## Coverage record

The sync commit, the files and symbols each check reads, and what is not covered are in [coverage.md](coverage.md). What the checks assume about the app (folders, routes, api paths, selectors, markers) is `scripts/lib/assumes.mjs`. Read it before you change a check or the code it covers.

## Keep it in step

Find whether the covered code moved since the sync commit:

```bash
git diff --stat ceb07502..HEAD -- apps/web/src/features apps/web/src/routes apps/web/src/components apps/web/index.html packages/ui/src packages/domain/src/starter.ts   # design checks
git diff --stat 5830242..HEAD -- apps/web/src/features apps/web/src/routes apps/web/src/components apps/web/index.html packages/ui/src packages/domain/src/starter.ts   # every other check
```

An empty diff means the record still holds. If it lists files, read the diff against the table in [coverage.md](coverage.md), then run the checker. Every line that changed state should match an intended change. If a rule no longer describes the code (a renamed label, a new region, a new surface), fix `tour.mjs`, `probe.mjs` or the rule and prove it again: break the property in a scratch change, see its line go FAIL, then revert and see the baseline return. Move the sync commit and the baseline line above only after you confirm the checks still describe the code at the new commit.

Never edit the app to make a check pass unless that was the task. A FAIL on today's app is a finding; report it.

## Helpers

- `verify-app-ui error: port 4450 is in use`: another run holds it. Pick `PORT=4452`, or stop the holder. Never kill a stack you did not start.
- `stack launch failed`: the message ends with the api and web log tails. A first boot under heavy load can need more time; rerun.
- `coach did not render at /coach` (or another route): the stack came up but the screen never showed its content. Open the URL by hand from `~/tmp/verify-app-ui/stack/<run>/run.env`, or rerun with `VERIFY_APP_UI_SHOTS`.
- `chrome did not start`: set `CHROME_BIN` to a Chromium or Chrome binary.
- A crashed run can leave the stack up: `OPENCV_VERIFY_ROOT=~/tmp/verify-app-ui/stack bash .claude/skills/verify-opencv/scripts/cleanup.sh app-ui-<pid>` (the run id is `app-ui-` and the node pid, listed under `~/tmp/verify-app-ui/stack/`).
- Scratch profiles live under `~/tmp/verify-app-ui/` and are removed on exit.
