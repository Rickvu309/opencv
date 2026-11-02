---
name: verify-landing
description: Check the OpenCV landing page for quality and taste, writing, logic, structure, visual craft, motion, accessibility and performance. A mechanical checker measures its properties in headless Chromium at 1440x900, 390x844 and reduced motion, and a judged rubric scores what a program cannot decide. Use after any change under apps/web/src/features/landing, apps/web/public/landing, a packages/ui component the landing imports (button), or the landing copy, and when asked whether the landing is good.
---

# verify-landing

Two layers. The checker (`scripts/verify-landing.mjs`) decides what a program can: counts, words, boxes, colors, computed styles, first-paint state. The rubric in [taste-review.md](taste-review.md) decides the rest, and three reviewers from different model families score it. Neither layer replaces the other. A green checker says the page follows the written rules. It does not say the page is good.

All paths are relative to the repo (or worktree) root. The rules come from the landing research (kept outside the repo) plus the pen parity checks. A property names its source when the checker comment still cites one.

## Run the checker

```bash
PORT=4399 pnpm --filter web verify:landing
```

- Starts the Vite dev server on `127.0.0.1:$PORT` if nothing answers there, and stops it at the end. If something already answers on the port, it refuses and exits 2, because that server may serve another tree. Stop it or pick another port; set `VERIFY_LANDING_REUSE=1` only when you started that server from this worktree. Use the `PORT` in this worktree's `.env`, or a free port you own.
- Needs `pnpm install` done and a Chromium. It looks for `$CHROME_BIN`, then `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome` (installed by the agent-browser tooling), then `chromium` on the path. No new dependency: it speaks the DevTools protocol over Node's built-in WebSocket.
- The page asks the api for a session before it renders. The checker answers every cross-origin fetch as a signed-out visitor (`null`), so no api, database or network is needed.
- The deep pass scrolls 400 ms a step (`REVEAL_SCROLL_STEP_MS` in `verify-landing.mjs`): headless Chromium delivers IntersectionObserver callbacks about 300 ms after a scroll, and at 120 ms a step the scroll reveals never fired, so the text stayed hidden for checks 21 and 23.
- About 20 s warm. One browser process, so do not run it beside install, vitest or another browser run on the shared machine.
- `VERIFY_LANDING_SHOTS=<dir>` also writes `desktop-first-view.png`, `desktop-full.png`, `mobile-first-view.png`, `mobile-full.png` (1440x900 and 390x844) for the taste review.

Output is one line per property, `PASS|FAIL|STALE <id> [<kind>] <name>: <measured> | rule: <rule>`, then `N PASS, M FAIL, K STALE: <ids> [tier <tier>]`. A check judges every part it can find. Any found part that breaks the rule makes it FAIL. With none broken, a part it could not locate (the hero section, `#benefits`, the nav lockup, a call-to-action button, the first product section) makes it STALE, and the line names it. A missing object the property is about (the hero figure, the benefit art, a product title) is a FAIL, not a STALE. Exit 0 all PASS, 1 any FAIL and no STALE, 3 any STALE, 2 the page did not render, the browser failed or the port was taken (an error, not a verdict). The pure text rules also have unit tests: `node --test .claude/skills/verify-landing/scripts/lib/text-rules.test.mjs` (no browser, under a second).

Reading a STALE: it means the check could not run that part, and the measured value names it ("not judged: ..."). A STALE hides nothing that was found, since any FAIL in the same check would have shown. Decide whether the checker's setup or the page changed. If the page dropped the section or button on purpose, repair the locator in `probe.mjs` or the check. If it lost it by accident, that is the regression: fix the page. A check that cannot run never counts as a pass.

Reading a FAIL: the measured value is what the page does, the rule is what it should do. Decide whether the page or the checker is wrong, in this order:

1. Is the measurement right? Compare it with the screenshot (`VERIFY_LANDING_SHOTS`) or the DOM in the browser. A number that does not match what you see is a probe bug: fix `scripts/lib/probe.mjs`.
2. Is the rule right? If the measurement is right but the rule misjudges (a good page fails, or a bad page passes), it is a rule bug: fix the rule in `text-rules.mjs` or `page-checks.mjs` and add a case to `text-rules.test.mjs` when the rule is a pure text rule.
3. Both right: it is a finding about the page. Report it. Do not edit the page unless that was the task.

## Tiers

Each check has one kind, in `scripts/lib/kinds.mjs` and [properties.md](properties.md). An invariant check holds for any good design: writing rules, WCAG, reduced motion, tokens, no sideways scroll. A design check holds only for the current one: a pen frame, a pinned count, size, copy or picture.

- `VERIFY_TIER=invariant` runs the invariant checks only. The design checks are not computed: the design probe does not run, nothing is rasterised, and no file under `design/` or `reference/` is read. Use it for any change that is not a redesign. A redesign does not break it.
- `VERIFY_TIER=design` reports only the design checks. `VERIFY_TIER=all` (default) runs both.
- The design numbers of 27 to 30 live in `apps/web/src/features/landing/design/landing.spec.json`, not in the checker. 31 reads `landing.styles.json` and `landing.omitted.json` beside it. Checks 06, 07, 08, 11, 12, 13, 14, 15, 16, 17 and 19 are design-tier rules that keep their copy and counts in `text-rules.mjs` and `page-checks.mjs`.
- `verify:pen-layout` and `verify:apply-pen` are separate commands and design by nature. The tier does not touch them.
- Unit tests: `node --test .claude/skills/verify-landing/scripts/lib`. The checker needs Node 24 (it uses the global `WebSocket`) and adds no dependency.
- The checker never edits the app.
- The probes (`probe.mjs`, `design-probe.mjs`, `pen-probe.mjs`) are serialised into the page, so they cannot close over module values. They only measure. `page-checks.mjs`, `design-checks.mjs`, `text-rules.mjs` and `text-style-check.mjs` decide.
- With no api running, the checker answers the landing's cross-origin session calls as a signed-out visitor (`null`), so the real page renders.
- `art-diff.mjs` decodes 8-bit RGB or RGBA PNGs only, non-interlaced, and throws on anything else. The reference crop and `canvas.toDataURL` both write that format. The compare reads the RGB channels and ignores alpha, because the page fills the card background and the pen crop is opaque.
- A spec missing a section or field is a setup error: the checker exits 2 before any check runs, and the spec is never read as a verdict.

After a redesign:

1. Run with `VERIFY_LANDING_SHOTS=<dir>` and look at the screenshots. A spec value is only as good as the page it was measured from, so the look comes first.
2. `node scripts/design-spec.mjs record --from-app <origin>`. It writes nothing. It prints one line per spec value, `unchanged` or `<id>.<path>: <committed> -> <measured>`, and exits 1 when anything differs (or a value sits outside a committed tolerance), 0 when nothing does. A recorder cannot tell a redesign from a regression, since any value it writes becomes the truth. Read its diff against the screenshots: a card count that fell from 3 to 2 or a type size that shrank is a regression to fix in the page, not a number to record.
3. Only when the diff is the redesign, run it again with `--accept` (optionally `--out <path>`) and commit the spec. `--accept` keeps the committed tolerances and locators (the nav gap band, the CTA tolerance, the art delta and ratio, the button labels, the Coach card title, the mark inset) and exits 2 without writing when a measurement is outside one, so move a tolerance by hand first. The spec holds design values only; rules such as "no inline hex" stay in the checker. It never writes `reference/coach-art.png`: that picture comes from the design tool or a screenshot a human approved, never from the page it judges. Replace it in its own reviewed commit.
4. The reviewer of that PR reads the spec diff the same way, against the same screenshots.

## The properties

Ids are the check numbers. The current page is the first-release marketing site. `properties.md` records which checks were kept, which were replaced, and why. Text rules 01 to 08 and 10 to 13 are in `scripts/lib/text-rules.mjs`. Page checks 14 to 26, including 20b, and 32 to 33 are in `scripts/lib/page-checks.mjs`, and 27 to 30 are in `scripts/lib/design-checks.mjs`. Check 31 is in `scripts/lib/text-style-check.mjs`. Id 09 is judged only.

- 01 `h1-length-and-aim`: 12 words or fewer; an outcome or audience word. Source: Shapiro litmus test; NN/g 2.2.
- 02 `statement-names-cv`: a block outside the nav names opencv and CV.
- 03 `subhead-two-beats`: 1 to 2 sentences, not a 3+ item list.
- 04 `no-marketese`: ban the marketese list in text-rules.mjs; exempt "your best work", "dream seat", and "fits best". Source: Nielsen.
- 05 `plain-sentences`: hero and product sentences are 24 words or fewer and not passive. The sentences are the hero paragraph and each product section paragraph. Source: OPM.
- 06 `product-titles-name-the-surface`: each product title (Paper, Apply, Coach) is 1 to 3 words.
- 07 `one-primary-label`: one sign-up label in the nav and one in the close, the same label, and none in the hero. A sign-up link is a `/sign-in` link whose label is not "Log in". The check does not require the words "Get started".
- 08 `label-has-object`: the sign-up label is "Get started", or another label of 2 or more words that is not a generic filler (Start free, Learn more, Join). Source: NN/g 4.1; Shapiro.
- 10 `objection-above-first-surface`: a block before the first product mentions the reader's CV, work, goals, or story ("your" or "your own"). Source: Shapiro.
- 11 `product-body-ties-to-hero`: each product intro paragraph names proof, a CV, a role, a letter, a site, a claim, an interview, or a job.
- 12 `designed-logos-and-quotes`: the logos eyebrow and both story quotes are in the page text; no star rating, invented user count, "trusted by", "as seen in", or price on /. This check reads page text, not alt text.
- 13 `customer-and-cv-alt`: an alt names a customer portrait, an alt names a CV or letter, none says placeholder.
- 14 `hero-photo-in-first-view-1440`: at 1440x900 the H1 and 120px or more of the hero visual share the first view. The hero visual is the Apply board figure, `<LandingFigure id="apply-board" />` (a `[role="img"]` element; an `<img>` also counts). The check measures that overlap, not the element type. Source: NN/g 3.1.
- 15 `nav-links-before-fold-390`: at 390, Product, Stories, and Pricing are visible without scrolling, on the page or in a menu the checker opens with one click. Blog and Help are not asserted. Source: NN/g 4.3.
- 16 `hero-has-no-button`: the hero has no button. A Sign in link in the hero must not look like a button. Source: Baymard.
- 17 `light-field-one-accent`: background luminance 0.85+; at most one saturated hue family (hues within 25 degrees merge, chroma 0.18+) on marketing text and shapes, product shots excluded. Source: Refactoring UI.
- 18 `h1-sentence-case-solid`: not uppercase, not gradient or transparent fill. Source: Linear homepage.
- 19 `images-named-and-local`: every `<img>` is served from `/landing/`. A `[role="img"]` figure (the hero and the product shots, drawn in DOM) has no file; its `aria-label` is its alt (labels are `LANDING_FIGURE_LABELS` in `landing-copy.ts`). Every image except `/landing/logo-*` and `/landing/story-*` needs an alt of 20 or more characters naming Coach, Paper, Apply, Proof, Pitch, a CV, or a letter. Logo and story images need only a non-empty alt. Source: NN/g 2.4.
- 20 `headline-visible-at-first-paint`: the H1 and subhead are not hidden, blurred or animated at first paint. They render plain, with no reveal. Source: NN/g 5.3.
- 20b `other-text-visible-at-first-paint`: no text inside the first view at 1440x900 or 390x844 starts hidden, blurred or animated. Dated exception (2026-10-28, #491: the operator asked for the scroll text reveal and the logo marquee): text whose document top is at or below the viewport height of that run may play a one-time reveal that starts on scroll into view, provided it renders settled under reduced motion (21 covers that). Figure text is not measured. Source: NN/g 5.3 on scroll-triggered text.
- 21 `reduced-motion-disables-animation`: with reduce, no element has a non-zero transition or animation duration (`transition: all` counts, so a kit Button's press motion counts), nothing runs or stays hidden, scroll is not smooth. Figures are not exempt except for their text. Source: WCAG 2.3.3.
- 22 `no-video-or-carousel`: no video, audio, iframe, autoplay, carousel-like class or scroll-snap. Dated exception (2026-10-28, #491: the operator asked for the scroll text reveal and the logo marquee): `#logos` may hold one marquee, with its repeated copies `aria-hidden` and no running animation under reduced motion. Any other carousel-like element still fails. Source: NN/g 5.2.
- 23 `text-contrast`: 4.5:1, or 3:1 at 24px+ (18.66px bold); text over gradients or images skipped; text inside a `[role="img"]` figure skipped. Source: WCAG 1.4.3.
- 24 `target-size-24`: every link and button 24x24, or a clear 24px circle (against other targets and other undersized circles); sign-up buttons are always 24x24. Source: WCAG 2.5.8.
- 25 `hero-image-attrs-and-paint`: an `<img>` hero has width, height, and fetchpriority=high, is not lazy, and does not start invisible. A `[role="img"]` figure hero has a non-zero box at first paint and does not start invisible. Opacity under 0.95, or a keyframe at opacity 0, fails either. Source: web.dev CLS and LCP.
- 26 `no-sideways-scroll`: the page does not scroll sideways at 1440 or 390.
- 27 `benefit-art-from-design`: the three benefit cards each contain one svg with viewBox "0 0 300 300", the path and ellipse count across them is 94 (the design art), and no element inside uses an inline hex colour. Source: opencv.pen Benefits frame.
- 28 `nav-lockup-spacing`: at 1440 the visible gap between the nav mark's right edge and the wordmark's left edge is 9 to 13 px (the mark box has 2 px of inner padding) and the wordmark computed font-size is 16px at weight 600. Source: opencv.pen nav Logo.
- 29 `cta-buttons-match-design`: nav and close button size, type, padding, shadow and border at 1440. Source: opencv.pen. Full rule in `properties.md`.
- 30 `benefit-art-matches-pen`: Coach benefit art matches `reference/coach-art.png`. Source: opencv.pen node oWS4Z. Crop and tolerance in `coach-art-crop.md`.
- 31 `text-style-matches-pen`: at 1440, each text in `landing.styles.json` that is on the page matches the fields opencv.pen sets (OKLCH colour, size, line height, weight, tracking), and each inline mark has an svg or img within 2px. A text the pen marks `startsLine` must start a line. That check runs at 1440 only. Dated exceptions cover the contrast-floor colours. A pen text missing from its section fails unless `design/landing.omitted.json` omits it. A heading split across inline elements is matched on the element's text, and each text run inside that element is checked. Text inside a `[role="img"]` figure is not looked up, and the per-word `.rv-w` spans of a revealed text are not texts of their own. Source: opencv.pen frame w7zeGR.
- 32 `touch-target-44-390`: the 390x844 run emulates a touch screen, so `(pointer: coarse)` matches. There, every link and button outside a `[role="img"]` figure is at least 44x44. STALE when the emulation leaves the pointer fine. Source: WCAG 2.5.5; Apple HIG.
- 33 `theme-color-matches-header`: in the same run, the `theme-color` meta matches the header fill within 2 per channel, so the phone browser bar joins the page. Source: the mobile-native skill.

Check 09 (the H1 alone says what is sold) is judged, as J1 in [taste-review.md](taste-review.md). It is not a measured line. Numbers drawn inside a screenshot (such as a percent on a card) cannot be read from the DOM. Check 12 reads page text, not alt text, and J4 judges the picture.

### Baseline at the sync commit

At `ceb07502` (main, checked in #510) the checker prints 30 PASS, 1 FAIL and 0 STALE: 31. The FAIL is a finding about the page, not the checker: the Customers foot link "Read all stories" renders as the muted `.landing-link` (`--muted-foreground`, 13px, no weight of its own) where the pen draws #1B1B1F at 14px weight 500, which is the `.landing-link[data-strong]` style. `6d431fdf` (#489) added the link and removed its `landing.omitted.json` row in the same change. The replacements and the reason for each check are in `properties.md`. A change that breaks one should flip its line to FAIL and nothing else.

## Run it by hand

Nothing runs this checker before a merge. Run it when you want it (`PORT=4399 pnpm --filter web verify:landing`). `known-findings.json` next to this file lists invariant FAILs you may treat as known, each `{ "id", "issue", "since", "note" }`.

## Taste review (judged layer)

The judged rubric, the protocol, and the reviewer prompt are in [taste-review.md](taste-review.md).

## Coverage record

The sync commit, the files and symbols each check reads, and what is not covered are in [coverage.md](coverage.md). What the checks assume about the app (folders, files, routes, section selectors) is `scripts/lib/assumes.mjs`, and `apps/web/src/test/verify-assumptions.test.ts` holds it against the repo on every push. Read it before you change a check or the code it covers.

## What else checks the landing

verify-landing checks only `/`.

Text parity with the pen frame is `apps/web/src/features/landing/landing-design-parity.test.tsx`. Dated omissions live in `apps/web/src/features/landing/design/landing.omitted.json`. Each row has an `until` date and a reason. That test covers copy this checker does not score: the integrations header and sentence, coming-next copy, benefit titles and bodies, and the Join the waitlist and Learn more labels. The integration logo names are alts, which only check 19 sees, and it asks only that they are non-empty.

Links and hashes are `.claude/skills/verify-marketing-links`. Run `pnpm --filter web verify:marketing`. That command covers `/`, `/pricing`, `/about`, `/help`, `/blog`, and every post.

## Keep it in step

Find whether the covered code moved since the sync commit:

```bash
git diff --stat ceb07502..HEAD -- apps/web/src/features/landing apps/web/public/landing apps/web/index.html packages/ui/src/components packages/ui/src/styles/globals.css
```

An empty diff means the record holds. Otherwise read the diff against the table in [coverage.md](coverage.md) and run the checker; every changed line must match an intended change. If a rule no longer fits the code, fix `probe.mjs` or the rule and prove it: break the property in a scratch copy, see it FAIL, restore, see the baseline. Move the sync commit only after the checks describe the code at the new commit.

Never edit the landing to make a check pass unless that was the task. A FAIL on today's page is a finding; report it.

## Helpers

- `verify-landing error: no H1 rendered`: the page did not load. Run `PORT=<port> pnpm --filter web dev` alone and open the URL, then rerun.
- `chrome did not start`: set `CHROME_BIN` to a Chromium or Chrome binary.
- `dev server did not answer`: the port is taken by something that does not serve the app, or the install is missing. Pick another port.
- Scratch profile dirs live under `~/tmp/verify-landing/` and are removed on exit.
