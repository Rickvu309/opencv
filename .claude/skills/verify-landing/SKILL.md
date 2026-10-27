---
name: verify-landing
description: Check the OpenCV landing page for quality and taste, writing, logic, structure, visual craft, motion, accessibility and performance. A mechanical checker measures 28 properties in headless Chromium at 1440x900, 390x844 and reduced motion, and a judged rubric scores what a program cannot decide. Use after any change under apps/web/src/features/landing, apps/web/public/landing, a packages/ui component the landing imports (button, card, separator), or the landing copy, and when asked whether the landing is good.
---

# verify-landing

Two layers. The checker (`scripts/verify-landing.mjs`) decides what a program can: counts, words, boxes, colors, computed styles, first-paint state. The rubric below decides the rest, and three reviewers from different model families score it. Neither layer replaces the other. A green checker says the page follows the written rules. It does not say the page is good.

All paths are relative to the repo (or worktree) root. The rules come from the landing research (kept outside the repo) plus the pen parity checks. Each property below names its source, so you do not need that file.

## Run the checker

```bash
PORT=4399 pnpm --filter web verify:landing
```

- Starts the Vite dev server on `127.0.0.1:$PORT` if nothing answers there, and stops it at the end. If something already answers on the port, it refuses and exits 2, because that server may serve another tree. Stop it or pick another port; set `VERIFY_LANDING_REUSE=1` only when you started that server from this worktree. Use the `PORT` in this worktree's `.env`, or a free port you own.
- Needs `pnpm install` done and a Chromium. It looks for `$CHROME_BIN`, then `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome` (installed by the agent-browser tooling), then `chromium` on the path. No new dependency: it speaks the DevTools protocol over Node's built-in WebSocket.
- The page asks the api for a session before it renders. The checker answers every cross-origin fetch as a signed-out visitor (`null`), so no api, database or network is needed.
- About 16 s warm. One browser process, so do not run it beside install, vitest or another browser run on the shared machine.
- `VERIFY_LANDING_SHOTS=<dir>` also writes `desktop-first-view.png`, `desktop-full.png`, `mobile-first-view.png`, `mobile-full.png` (1440x900 and 390x844) for the taste review.

Output is one line per property, `PASS|FAIL <id> <name>: <measured> | rule: <rule>`, then `N PASS, M FAIL: <ids>`. Exit 0 all pass, 1 any FAIL, 2 the page did not render, the browser failed or the port was taken (an error, not a verdict). Under 40 lines. The pure text rules also have unit tests: `node --test .claude/skills/verify-landing/scripts/lib/text-rules.test.mjs` (no browser, under a second).

Reading a FAIL: the measured value is what the page does, the rule is what it should do. Decide whether the page or the checker is wrong, in this order:

1. Is the measurement right? Compare it with the screenshot (`VERIFY_LANDING_SHOTS`) or the DOM in the browser. A number that does not match what you see is a probe bug: fix `scripts/lib/probe.mjs`.
2. Is the rule right? If the measurement is right but the rule misjudges (a good page fails, or a bad page passes), it is a rule bug: fix the rule in `text-rules.mjs` or `page-checks.mjs` and add a case to `text-rules.test.mjs` when the rule is a pure text rule.
3. Both right: it is a finding about the page. Report it. Do not edit the page unless that was the task.

## The properties

Ids are the check numbers. The current page is the first-release marketing site. `properties.md` records which checks were kept, which were replaced, and why. The id is also the line to search in `scripts/lib/text-rules.mjs` (01 to 13) or `scripts/lib/page-checks.mjs` (14 to 28, 20b).

- 01 `h1-length-and-aim`: 12 words or fewer; an outcome or audience word. Source: Shapiro litmus test; NN/g 2.2.
- 02 `audience-in-h1-or-subhead`: the word Vietnamese and student(s) or new/recent graduate(s) in H1 or subhead. Source: NN/g 2.3; Digital.gov.
- 03 `subhead-two-beats`: 1 to 2 sentences, defines the product, not a 3+ item list (heuristic). Source: Shapiro.
- 04 `no-marketese`: no best, #1, dream, seamless, empower, revolutionize, supercharge, plus a few extras, even after "your" or "our"; only the exact phrase "your best work" is exempt. Source: Nielsen.
- 05 `plain-sentences`: hero and surface sentences 20 words or fewer, not passive (regex). Source: OPM.
- 06 `surface-titles-state-outcome`: title 3+ words, product name kept as label (heuristic). Source: Shapiro; NN/g 2.3.
- 07 `one-primary-label`: one label across nav, hero, closing, once each. Source: Baymard; Shapiro.
- 08 `label-has-object`: 2+ words naming the next step, not a bare verb with a filler (Start free, Get started, Learn more, Join, Try now); Start learning and Find food pass. Source: NN/g 4.1; Shapiro.
- 10 `objection-above-first-surface`: a block saying "from your own CV or goals" comes earlier in the DOM than the first surface section (heuristic wording, real position). Source: Shapiro.
- 11 `surface-first-sentence-ties-to-hero`: first sentence has first job, CV, application, job or page (keywords). Source: Shapiro.
- 12 `no-proof-markup`: no logo, testimonial, star, price, count or percent in text or alt. Source: FTC endorsement guides; Nielsen.
- 13 `sample-person-alt`: an alt names a student or graduate; Paper alt names a CV or letter; no placeholder (alt text only). Source: NN/g 3.2.
- 14 `coach-frame-in-first-view-1440`: H1 bottom inside 900px and 120px or more of the Coach frame visible. Source: NN/g 3.1.
- 15 `surface-names-before-fold-390`: four surface-name links visible at 390x844 without scrolling, in the page or after the checker clicks one `header button[aria-expanded=false]` (menu or sheet links count). Source: NN/g 4.3.
- 16 `hero-one-primary-button`: one button in the hero; Sign in there is a text link. Source: Baymard.
- 17 `light-field-one-accent`: background luminance 0.85+; at most one saturated hue family (hues within 25 degrees merge, chroma 0.18+) on marketing text and shapes, product shots excluded. Source: Refactoring UI.
- 18 `h1-sentence-case-solid`: not uppercase, not gradient or transparent fill. Source: Linear homepage.
- 19 `images-are-product-with-alt`: each image under /landing/ with an alt of 20+ characters naming a surface. Source: NN/g 2.4.
- 20 `headline-visible-at-first-paint`: the H1 and subhead are not hidden, blurred or animated at first paint. Source: NN/g 5.3.
- 20b `other-text-visible-at-first-paint`: no other text (the closing line) starts hidden, blurred or animated, so nothing waits for a scroll trigger. Source: NN/g 5.3 on scroll-triggered text.
- 21 `reduced-motion-disables-animation`: with reduce, no element has a non-zero transition or animation duration (`transition: all` counts, so a kit Button's press motion counts), nothing runs or stays hidden, scroll is not smooth. Source: WCAG 2.3.3.
- 22 `no-video-or-carousel`: no video, audio, iframe, autoplay, carousel-like class or scroll-snap. Source: NN/g 5.2.
- 23 `text-contrast`: 4.5:1, or 3:1 at 24px+ (18.66px bold); text over gradients or images skipped. Source: WCAG 1.4.3.
- 24 `target-size-24`: every link and button 24x24, or a clear 24px circle (against other targets and other undersized circles); sign-up buttons are always 24x24. Source: WCAG 2.5.8.
- 25 `hero-image-attrs-and-paint`: width, height, fetchpriority=high, not lazy, no opacity-0 start. Source: web.dev CLS and LCP.
- 26 `no-sideways-scroll`: the page does not scroll sideways at 1440 or 390.
- 27 `benefit-art-from-design`: the three benefit cards each contain one svg with viewBox "0 0 300 300", the path and ellipse count across them is 94 (the design art), and no element inside uses an inline hex colour. Source: opencv.pen Benefits frame.
- 28 `nav-lockup-spacing`: at 1440 the visible gap between the nav mark's right edge and the wordmark's left edge is 9 to 13 px (the mark box has 2 px of inner padding) and the wordmark computed font-size is 16px at weight 600. Source: opencv.pen nav Logo.

Check 09 (the H1 alone says what is sold) is judged, as J1 below. Numbers drawn inside a screenshot (such as a percent on a card) cannot be read from the DOM; 12 reads text and alt, and J4 judges the picture.

### Baseline at the sync commit

At `88e2d37` the previous landing printed 25 PASS. The first-release page replaced checks that described that page. The replacements and the reason for each are in `properties.md`. The checker now prints 28 lines. A change that breaks one should flip its line to FAIL and nothing else.

## Taste review (judged layer)

Eight judged items, each scored 0, 1 or 2, with an anchor text for 0 and for 2 (1 sits between). The anchors live in the reviewer prompt below, which is the single source:

- J1 the H1 alone says what is sold and for whom (research check 9)
- J2 each section earns the next
- J3 the objection "will this write a generic CV?" is answered before the first surface
- J4 the promise is proven
- J5 the sample is the right story
- J6 copy is specific
- J7 visual quiet
- J8 motion restraint

### Protocol

1. Run the checker with `VERIFY_LANDING_SHOTS=~/tmp/verify-landing/shots-<run>`. The four PNGs are the page every reviewer sees. Do not share the checker output with reviewers.
2. Spawn three reviewers from different model families, for example Claude, GPT through Codex, and Gemini or Grok through the T3 delegate. Each reads the four images and the source copy (`apps/web/src/features/landing/landing-copy.ts`), alone, with the prompt below. They do not see each other's scores.
3. A check passes at a median of 2 across the three. Any 0 from any reviewer is a finding, even when the median passes. The report lists each finding with the reviewer's quoted reason.
4. A reviewer who returns no reason for a score of 0 or 1 is rerun once with the same prompt; the second answer counts.

### Reviewer prompt

Copy this exactly, replacing the four image paths.

```text
You are reviewing the landing page of OpenCV, a career coach for Vietnamese students and new graduates who want a first job. You see four screenshots: <desktop-first-view.png> (the first screen at 1440x900), <desktop-full.png> (the whole page), <mobile-first-view.png> (the first screen at 390x844), <mobile-full.png> (the whole page). The page copy is in <landing-copy.ts>. Judge only what you can see and read; do not open the code or run anything.

Score each item 0, 1 or 2, using the anchors. 1 sits between them.
J1 The H1 alone says what is sold and for whom. 0: the reader needs the subhead or picture to know. 2: one sentence tells a stranger the product and who it helps.
J2 Each section earns the next. 0: a section repeats the last, or the order could be shuffled. 2: each section answers the question the last one raised.
J3 The objection "will this write a generic CV?" is answered before the first product section. 0: the doubt is still open at the first product section. 2: a sentence above it answers in the reader's terms.
J4 The promise is proven. 0: the claim is stated and nothing shows how. 2: the page shows what the coach does, with concrete evidence and no invented number.
J5 The sample is the right story. 0: a stranger, a placeholder title, or a performance figure. 2: a student's first role or school project, a real CV or letter, no percent.
J6 Copy is specific. 0: a sentence would fit any product, or leans on mood. 2: each sentence names a thing the product does, in the reader's words.
J7 Visual quiet. 0: competing accents, decoration or crowding fight the one action. 2: grey and one action, whitespace and type carry the hierarchy.
J8 Motion restraint. You cannot see motion in a still. Score it from the copy and layout: 0 if text or the product shot probably arrives late or decorated, 2 if it reads as present at first paint. If you cannot tell, score 1 and say so.

Answer with JSON only, no other text:
{"scores":{"J1":{"score":0,"reason":"<one sentence naming what you saw>"},"J2":{...},"J3":{...},"J4":{...},"J5":{...},"J6":{...},"J7":{...},"J8":{...}}}
Every reason is one sentence and quotes or names the thing on the page. Do not praise. Do not suggest fixes.
```

J8 is partly decided by checks 20, 21 and 25; the reviewers see stills, so treat J8 as a read on the layout and copy, and trust 20, 21 and 25 for the motion facts.

## Coverage record

Sync commit: `88e2d37`, the head of PR #296 (craft pass) at which the checks were last run against the landing. The checks describe the landing as of that commit.

| Checks                   | Files and symbols they read                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01 to 06, 08, 10, 11, 13 | `apps/web/src/features/landing/landing-copy.ts`: `LANDING_HEADLINE`, `LANDING_SUBHEAD`, `LANDING_SURFACES` (title, body, shot.alt), `LANDING_HERO_SHOT.alt`, `LANDING_CTA`, `LANDING_TITLE`, and `apps/web/index.html` (title and meta description, read by 04); rendered by `landing-page.tsx`, `landing-hero.tsx`, `landing-surface.tsx` |
| 07, 16                   | `landing-nav.tsx` `LandingNav`, `landing-hero.tsx` `LandingHero` (the hero buttons and the Sign in link), `landing-page.tsx` closing `Section`                                                                                                                                                                                             |
| 12, 22                   | all text, alt text and markup of the rendered page, including `landing-footer.tsx`                                                                                                                                                                                                                                                         |
| 14, 25                   | `landing-hero.tsx`, `landing-surface.tsx` `LandingShot` (`width`, `height`, `fetchPriority`)                                                                                                                                                                                                                                               |
| 15                       | `landing-nav.tsx` `nav` (the Surfaces links, a second row below `md`), `landing-footer.tsx`                                                                                                                                                                                                                                                |
| 17, 18, 23, 24           | `landing.css` (`.landing-h1`), tokens in `packages/ui/src/globals.css`, `packages/ui/src/components/button.tsx`, `card.tsx`, `section.tsx`, `separator.tsx`                                                                                                                                                                                |
| 19                       | `LandingShot` `<img alt>`, `apps/web/public/landing/*.webp`                                                                                                                                                                                                                                                                                |
| 20, 20b, 21              | `landing.css` (`@media (prefers-reduced-motion)`), `landing-nav.tsx` scroll transition, `packages/ui/src/components/button.tsx` (`transition-all`)                                                                                                                                                                                         |
| 27                       | `#benefits` svgs from `landing-figures.tsx` and `figures/*-art.tsx` (viewBox, path and ellipse count, inline hex)                                                                                                                                                                                                                          |
| 28                       | `landing-nav.tsx` `OpenCvLogo` mark and wordmark at 1440 (visible gap, font-size, weight)                                                                                                                                                                                                                                                  |
| Probes and rules         | `.claude/skills/verify-landing/scripts/lib/probe.mjs` (in-page measurements), `text-rules.mjs`, `page-checks.mjs`                                                                                                                                                                                                                          |

Constants the checks assume: the four surface ids (`coach`, `paper`, `apply`, `pitch`), the route `/`, `h1` and `main > section` structure, a sign-up link with `href="/sign-up"`, and images under `/landing/`. If a change moves one, update `probe.mjs` and the rule that reads it in the same PR.

Not covered: pixel content of screenshots (judged, J4 to J7), real-device and Safari rendering, network speed and measured LCP (check 25 reads attributes, not timings), screen reader output, keyboard order and focus rings, the signed-in redirect, and any page other than `/`.

## Keep it in step

Find whether the covered code moved since the sync commit:

```bash
git diff --stat b11dd50..HEAD -- apps/web/src/features/landing apps/web/public/landing apps/web/index.html packages/ui/src/components packages/ui/src/globals.css
```

An empty diff means the record still holds. If it lists files, read the diff against the table above, then run the checker. Every line that changed state should match an intended change. If a rule no longer describes the code (a renamed class, a new region, a new surface), fix `probe.mjs` or the rule and prove it again: break the property in a scratch copy of the page, see its line go FAIL, then restore the page and see the baseline return. Move the sync commit and the baseline line above only after you confirm the checks still describe the code at the new commit.

Never edit the landing to make a check pass unless that was the task. A FAIL on today's page is a finding; report it.

## Helpers

- `verify-landing error: no H1 rendered`: the page did not load. Run `PORT=<port> pnpm --filter web dev` alone and open the URL, then rerun.
- `chrome did not start`: set `CHROME_BIN` to a Chromium or Chrome binary.
- `dev server did not answer`: the port is taken by something that does not serve the app, or the install is missing. Pick another port.
- Scratch profile dirs live under `~/tmp/verify-landing/` and are removed on exit.
