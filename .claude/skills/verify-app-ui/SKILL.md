---
name: verify-app-ui
description: Check the interior quality and taste of the signed-in OpenCV app (Home and Coach, Paper, Apply, Pitch), covering writing, logic, structure, visual craft, motion, accessibility and performance. A mechanical checker signs up a throwaway account on a PGlite stack and measures 44 properties in headless Chromium at 1440x900, 390x844 and reduced motion, and a judged rubric scores what a program cannot decide. Use after any change under apps/web/src/features/home, coach, paper, apply, pitch, app-shell, apps/web/src/routes, or a packages/ui component those import (button, card, dialog, empty, input, kbd, skeleton, spinner, tabs, tooltip, badge), the motion tokens in packages/ui/src/styles/globals.css, and when asked whether the app is good.
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

Output is one line per property, `PASS|FAIL <id> <name>: <measured> | rule: <rule>`, then `N PASS, M FAIL: <ids>`. Exit 0 all pass, 1 any FAIL, 2 the stack, the browser or a screen did not work (an error, not a verdict). 46 lines (44 properties, the header, the summary). The pure text and color rules have unit tests: `node --test .claude/skills/verify-app-ui/scripts/lib/text-rules.test.mjs` (no browser, under a second).

What the tour does, in order, signed in at 1440x900: visits every route once to warm the dev server; then for Home, Paper, Apply and Pitch it loads the route and times it, walks Tab to the primary action, and measures the screen. On Home it opens Search with Ctrl-K and sends "Review my CV" for a scripted Coach turn. On Paper it opens the sample CV and the Coach float. On Pitch it reads the coming-soon page and does not open a story. Scenario pages follow: `GET /api/paper` held while the page is read, `GET /api/paper` answered with an empty list, the Coach send answered with `404 USER_NOT_FOUND "User not found."`, and the Coach send with the connection refused. A reduced-motion pass and a 390x844 mobile pass visit the four routes again. Last, the tour deletes the four seeded Apply cards through the api (`apply.deleteCard`) and reads the empty board. A step that does not happen (a click finds nothing, a screen never renders, the deletes fail) throws and the run exits 2; it is never a pass. The api answers are the only mocks, apart from the scripted Coach and the stub posting scan that verify-opencv already isolates; say so in a report. The throwaway account is not reused, and the stack and its data are removed at the end.

Reading a FAIL: the measured value is what the app does, the rule is what it should do. Decide whether the app or the checker is wrong, in this order:

1. Is the measurement right? Read `VERIFY_APP_UI_DATA`, or compare with the screenshot. A number that does not match what you see is a probe bug: fix `scripts/lib/probe.mjs`.
2. Is the rule right? If the measurement is right but the rule misjudges (a good screen fails, or a bad screen passes), fix the rule in `checks.mjs`, `checks-content.mjs` or `text-rules.mjs` and add a case to `text-rules.test.mjs` when it is a pure text rule.
3. Both right: it is a finding about the app. Report it. Do not edit the app unless that was the task.

## Apply against opencv.pen

`PORT=4454 heavy -- pnpm --filter web verify:apply-pen` holds every Apply state to its pen frame. See [apply-pen.md](apply-pen.md).

## The properties

Forty-four named properties; ids 01 to 30 are the research check numbers, 31 to 38 are app-wide checks the signed-in tour adds, and 39 to 44 are the design text rules (pinned phrases in `scripts/lib/copy.json`). Each has a rule, a source and a note when it is a heuristic: read [properties.md](properties.md). Search the id in `scripts/lib/checks-content.mjs` (01 to 13) or `scripts/lib/checks.mjs` (14 to 44).

## Baseline at the sync commit

At `5830242` (the app code is the same as `aa8063d`; the commits between them changed only test files) the checker prints 17 PASS and 21 FAIL: 01 02 04 05 06 07 08 10 12 14 17 18 19 20 22 24 28 30 31 32 33. PASS: 03 09 11 13 15 16 21 23 25 26 27 29 34 35 36 37 38. These are findings about the app, not defects in the checker: job, email, document and profile in chrome labels (01); three composer placeholders (02); the raw "User not found." on a 404 send (04; a refused connection already gets a sentence); "like Instagram Stories" (05); "Your name" as the CV title (06); "+18%" and "add-to-cart" on the starter Pitch (07); no Approve or Deny anywhere (08); with every card deleted, five empty wells instead of one empty state (10); "Hit Publish" with no Publish button in view (12); both Home cards open on first paint (14); no key hint on Search (17); "Filter · Coming soon" on Paper (18); a black tile and a mint gradient tile on Pitch (19); 47 text nodes under 4.5:1, such as the Draft pill and avatar initials at 4.35 (20); an always-on aria-hidden Apply dot (22); 100 ms and 200 ms durations in the kit and 200 ms and 75 ms durations in feature source (24); 32px primary buttons (28); no Reject control (30); no h1 on Paper and two on Pitch (31); 36 Tab presses to reach the Home composer (32); a 404 for /favicon.ico on every load (33). Check 15 passes at 1440 wide because the Coach float sits beside the CV there; a narrower window can overlap. A change that fixes one finding should flip its line to PASS and nothing else.

## Pen layout check

`pnpm --filter web verify:pen-layout` holds each built screen to the text layout of its pen frame. The text parity tests only compare words. This check compares where the words sit. It starts the same stack as the checker (PORT 4450 to 4458, api on PORT, web on PORT+1), signs up a throwaway account and visits every route at 1440x900, dpr 1, reduced motion.

- **Input.** Every `apps/web/src/features/**/design/*.layout.json`. Each file records, for one pen frame, every visible text with its box, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `color` and `textAlign`, relative to the pen's main panel `GIhbq`.
- **What it measures.** The app's `#app-main` panel stands for `GIhbq`. For each pen text it finds the smallest visible element whose own text (whitespace collapsed, `<br />` read as a space) equals the pen text, and measures the text itself, not its box.
- **Tolerances.** Position within 8 px (left edge for left text, centre for centred, right edge for right, top edge for y). `fontSize` within 0.5 px. `fontWeight` exact. `letterSpacing` within 0.3 px. Colour within 0.04 OKLab distance. A missing text fails.
- **Output.** One `FAIL <frameId> <route> "<text>" <property>: pen <v> app <v>` line per mismatch, one `PASS|FAIL` line per layout, then a summary. Exit 0 all match, 1 any mismatch, 2 the stack, browser or a route failed. `VERIFY_PEN_LAYOUT_SHOTS=<dir>` saves a screenshot per route. `VERIFY_PEN_LAYOUT_DATA=<file>` saves the raw app measurements.
- **Add a screen.** Run `node scripts/pen-layout.mjs <pen file> <frame id> apps/web/src/features/<surface>/design/<name>.layout.json --route <path>` (add `--png <file>` to look at the render, `--pane <node id>` when the frame's content panel is not `GIhbq`) and commit the JSON. Never edit a layout by hand. Regenerate it when the pen changes.
- **Exceptions.** `PEN_LAYOUT_EXCEPTIONS` in `scripts/lib/pen-layout-compare.mjs` starts empty. An entry is `{ frameId, text, property, reason, until, approvedBy }`. It hides one property of one text until the `until` date. An expired entry fails, and so does a stale one whose property now matches. An operator approves each entry.
- **Tests.** `node --test .claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.test.mjs` covers the comparison without a browser. It includes recorded measurements of the old Pitch page, which must fail.

## Taste review (judged layer)

Ten judged items, J1 to J10, each scored 0, 1 or 2 with anchors for 0 and 2. The items, the protocol (three reviewers from different model families, median of 2 passes, any 0 is a finding) and the exact reviewer prompt are in `rubric.md`. Copy the prompt from there; do not paraphrase it. Run the checker with `VERIFY_APP_UI_SHOTS` first; the screenshots are what the reviewers see. Do not show reviewers the checker output.

## Coverage record

Sync commit: `5830242`, the origin/main head at which the checks were last confirmed against the app (run on the `aa8063d` tree; the two commits after it touched only test files and plan docs, checked with the diff command below). The checks describe the app as of that commit.

| Checks             | Files and symbols they read                                                                                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01, 02, 03, 05     | rendered chrome of all screens: `features/home/home-dashboard.tsx` (placeholders), `features/coach/coach-dock.tsx` (`placeholder`), `features/paper/coach-float.tsx`, `apply-workspace.tsx`, `pitch-workspace.tsx`, `paper-workspace.tsx`, `features/home/suggestions.ts`, `pitch-stories.tsx` |
| 04, 27             | `features/coach/coach-error.ts` `coachSendErrorMessage`, `lib/api-error.ts`, `components/error-banner.tsx`, `features/coach/chat-view.tsx`; the call `POST /api/chats/<id>/turns` in `chat-api.ts`; `paper-editor-conflict-banner.tsx`                                                         |
| 06, 07             | `packages/domain/src/starter.ts` (`STARTER_CV_PERSON_NAME`, Pitch starter), rendered by `paper-cv-document.tsx` and `pitch-workspace.tsx`                                                                                                                                                      |
| 08, 09, 30         | `features/coach/*`, `features/coach/rich-receipts.tsx`, `coach-receipt.ts`, `features/paper/paper-editor-toolbar.tsx`; source scan of `features/{coach,home,paper,apply,pitch,app-shell}`                                                                                                      |
| 10, 13, 16, 23, 36 | `features/apply/apply-workspace.tsx` (`BoardJobCard`, `data-card-id`, stage columns), `apply-types.ts` stages; the call `GET /api/apply`                                                                                                                                                       |
| 11, 18, 29         | `features/paper/paper-workspace.tsx` (`paper.isLoading`, Filter control); the call `GET /api/paper`                                                                                                                                                                                            |
| 12, 28, 31         | `features/coming-soon/pages.tsx` (Pitch promise h1, Get early access); `paper-editor-header.tsx`                                                                                                                                                                                               |
| 14                 | `features/home/home-dashboard.tsx`, `aim-prompt.tsx`, `first-cafe-checklist.tsx`                                                                                                                                                                                                               |
| 15                 | `features/paper/coach-float.tsx` (fixed or absolute panel), `paper-editor.tsx`                                                                                                                                                                                                                 |
| 17, 22             | `features/app-shell/app-sidebar.tsx` (`PRIMARY_NAV`, `ActivityBadge`), `search-modal.tsx`, `app-shell-layout.tsx` (Ctrl-K)                                                                                                                                                                     |
| 19, 20, 21, 35, 37 | tokens in `packages/ui/src/styles/globals.css`, kit components in `packages/ui/src/components`, coming-soon previews in `features/coming-soon`                                                                                                                                                 |
| 24, 25, 26         | `packages/ui/src/styles/globals.css` (`--duration-*`, the reduced-motion block), `features/command-palette/command-palette.tsx`, source scan for `text-reveal`                                                                                                                                 |
| 32, 33, 34, 38     | `routes/*.tsx`, `router.tsx`, `features/app-shell/app-shell-layout.tsx` and `app-sidebar.tsx` (rail at narrow width)                                                                                                                                                                           |
| Probes and rules   | `scripts/lib/probe.mjs` and `probe-colors.mjs` (in-page measurements), `tour.mjs` (the drive), `checks-content.mjs`, `checks.mjs`, `text-rules.mjs`                                                                                                                                            |

Constants the checks assume: the primary-action patterns in `tour.mjs` (`PRIMARY`: Home `Message Coach` or `Send`, Paper `New` or `Make mine`, Apply a button starting `Add `, Pitch `Get early access`; check 32 reads them, so renaming a label turns 32 into none in 60); the card delete command `apply.deleteCard` and `GET /api/apply` (check 10 deletes the seeded cards through them); `GET /api/paper` answered with an empty list (check 29); the Apply card `aria-label` of the form `<title> at <company>` (check 36 finds the title by that text); the command palette open transition in `features/command-palette` (check 25); the routes `/home`, `/paper`, `/apply`, `/pitch`; the starter CV named "Sample internship CV"; `[data-card-id]` on Apply cards; a button labelled "Coach" that opens the Paper float; a button labelled "Get early access" on Pitch; `nav[aria-label=Surfaces]` with links named Home, Search, Paper, Apply, Pitch; `h1`; sign-up at `POST /api/auth/sign-up/email`. If a change renames one, update `tour.mjs` or `probe.mjs` and the rule that reads it in the same PR. The tour throws (exit 2) when Home, Paper, Apply or Pitch does not render.

Follow-up: unproven checks. Nine checks have never been seen failing on a scratch break: 09, 15, 16, 21, 23, 27, 34, 35 and 38. Each fails safe when its state is missing (an empty list, a missing element, a null time), but a break that flips each one has not been run. When touching one, break it first and record the proof.

Not covered: pixel content of screenshots (judged), a Coach turn that writes (the scripted Coach only reads, so checks 08 and 30 read source and checks 09 reads a read turn), the signed-out and public pages (`/`, `/u/<slug>`, see verify-landing), Settings and Search as screens, drag and drop, the Apply scan, publishing a Pitch, real-device and Safari rendering, measured LCP, screen-reader output, focus-ring visuals, dark mode, and widths other than 1440 and 390.

## Keep it in step

Find whether the covered code moved since the sync commit:

```bash
git diff --stat 5830242..HEAD -- apps/web/src/features apps/web/src/routes apps/web/src/components apps/web/index.html packages/ui/src packages/domain/src/starter.ts
```

An empty diff means the record still holds. If it lists files, read the diff against the table above, then run the checker. Every line that changed state should match an intended change. If a rule no longer describes the code (a renamed label, a new region, a new surface), fix `tour.mjs`, `probe.mjs` or the rule and prove it again: break the property in a scratch change, see its line go FAIL, then revert and see the baseline return. Move the sync commit and the baseline line above only after you confirm the checks still describe the code at the new commit.

Never edit the app to make a check pass unless that was the task. A FAIL on today's app is a finding; report it.

## Helpers

- `verify-app-ui error: port 4450 is in use`: another run holds it. Pick `PORT=4452`, or stop the holder. Never kill a stack you did not start.
- `stack launch failed`: the message ends with the api and web log tails. A first boot under heavy load can need more time; rerun.
- `home did not render at /home` (or another route): the stack came up but the screen never showed its content. Open the URL by hand from `~/tmp/verify-app-ui/stack/<run>/run.env`, or rerun with `VERIFY_APP_UI_SHOTS`.
- `chrome did not start`: set `CHROME_BIN` to a Chromium or Chrome binary.
- A crashed run can leave the stack up: `OPENCV_VERIFY_ROOT=~/tmp/verify-app-ui/stack bash .claude/skills/verify-opencv/scripts/cleanup.sh app-ui-<pid>` (the run id is `app-ui-` and the node pid, listed under `~/tmp/verify-app-ui/stack/`).
- Scratch profiles live under `~/tmp/verify-app-ui/` and are removed on exit.
