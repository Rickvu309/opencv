# verify-app-ui properties

The full list the checker measures. `SKILL.md` links here.

Ids 01 to 30 are the research check numbers. 31 to 38 are app-wide checks the signed-in tour adds. A heuristic is a word list or threshold that can misjudge; it says so in its rule text. Search the id in `scripts/lib/checks-content.mjs` (01 to 13) or `scripts/lib/checks.mjs` (14 to 38).

Writing and logic:

- 01 `product-nouns`: no chrome label (button, placeholder, empty line, banner, aria-label) calls a product object job, email, document or profile. Exempt: a short goal chip that starts with A or An ("A first full-time job"), the "Connect email, optional" row, and the account menu label "<name>, profile and settings". Nothing else, so "Drop a dream job here" fails. Source: Apple writing; WCAG 3.2.4.
- 02 `one-composer-placeholder`: Home, the Thread and the Paper Coach float use one placeholder. Source: Apple writing.
- 03 `button-labels-act`: no Click here, Learn more, OK (heuristic; a joke label cannot be decided). Source: Apple writing.
- 04 `coach-error-not-raw`: the tour sends twice, once with the api answering 404 `USER_NOT_FOUND "User not found."` and once with the connection refused. Each must show an error in a live region, and neither may show the raw message or a transport error such as Failed to fetch. No error shown is a FAIL. Source: Apple feedback.
- 05 `no-other-product-names`: no social product name (Instagram, TikTok, Snapchat, Facebook, Twitter, YouTube, Pinterest, WhatsApp, Linktree). Integrations such as GitHub and Gmail are not matched. Source: Apple writing.
- 06 `starter-cv-name`: the open CV title is not "Your name". Source: NN/g empty states.
- 07 `pitch-starter-no-metric`: no percentage, no "N percent", no add-to-cart on Pitch. Source: NN/g hallucinations.
- 08 `confirm-before-write`: a JSX label or quoted string Approve and Deny exists in the Coach features (source read; comments and type names do not count; the scripted Coach never writes). Source: shadcn Confirmation; Gemini.
- 09 `tool-line-names-object`: a Coach step status line that is not an error names Apply, CV, Letter, Proof, Pitch, Opportunity or card (case-sensitive; driven with a read turn, not a write). Source: shadcn AI Elements.
- 10 `empty-board-one-empty-state`: the tour deletes the four seeded cards through the api, reloads Apply, and requires 0 cards, the five stage headers and exactly one empty state on the board (five wells or none both fail; a board that was not confirmed empty is a FAIL). Source: NN/g.
- 11 `loading-not-empty`: while the Paper call is held the page says "Loading documents" or "Loading..." and not "No documents yet". Source: NN/g.
- 12 `unpublished-banner-has-publish`: if the banner says Hit Publish, a Publish button is on screen. Source: NN/g.
- 13 `fit-not-bare-number`: a percentage on a board card passes only with a basis phrase (because, based on, from your, matches your) inside that same card; a percentage outside any card fails. Source: NN/g.

Structure:

- 14 `home-composer-first`: Home does not show both "What are you aiming for?" and "Four small things" on first paint. Source: Apple layout.
- 15 `cv-widest-coach-beside`: with the Coach open, the CV is the widest region and the Coach, a floating panel or an in-flow side pane, covers none of its text (at 1440 wide; a narrower window can overlap). Source: Cursor; Linear.
- 16 `apply-five-stages-no-hscroll`: Inbox, Prep, Sent, Live, Closed found as visible column headers beside the stage dots, no horizontal scroll. Source: `apply-workspace.tsx`; Material density.
- 17 `search-key-hint`: the Search item has a `kbd` and Ctrl-K opens the dialog. Source: Raycast.
- 18 `paper-no-disabled-filter`: no Paper control says Coming soon. Source: Apple feedback.

Visual craft:

- 19 `light-field-sparse-accent`: body luminance 0.85+; no dark or tinted decorative fill of 6000px2 or more, including gradients (a gradient that fades to transparent is a photo scrim and is skipped). Heuristic. Source: Refactoring UI.
- 20 `text-contrast`: 4.5:1, or 3:1 at 24px (18.66px bold). Skipped: text over images and gradients, disabled controls, aria-hidden text and svg. Source: WCAG 1.4.3.
- 21 `target-size-24`: every link and button 24x24, or a 24px circle that touches no other target; controls that are hidden until hover are not measured. Source: WCAG 2.5.8.
- 22 `apply-dot-count-or-absent`: the Apply nav item has no dot, or the dot has a count or an accessible name (an aria-hidden dot has none). The Apply nav item not found is a FAIL. Source: Apple feedback.
- 23 `stage-word-plus-dot`: each stage dot sits beside its word. Source: Apple feedback.

Motion:

- 24 `motion-tokens`: every computed transition and animation runs 150 ms or 280 ms on the toured screens, including an open Pitch story, and no `duration-N` class or `Nms` value in features or routes source is off-token (so the 75 ms in `pitch-stories.tsx` counts). Looping spinners and skeletons are skipped. Source: `globals.css`; the program motion rule.
- 25 `reduced-motion`: with reduce, nothing over 1 ms runs, scroll is not smooth, and every timer-driven motion under `features/pitch` and the `use-*` hooks it imports (`requestAnimationFrame`, `setInterval`, `setTimeout` other than a flag reset such as `setCopied(false)`) sits in a file that checks the preference. If the scan finds no timer at all the check FAILs with "no story timer found". Source: WCAG 2.3.3.
- 26 `no-text-reveal`: no app file imports text-reveal (source read). Source: Apple layout.

Accessibility and performance:

- 27 `alerts-have-role`: the Coach error sits in a live region, no red text outside one, the conflict banner keeps `role="alert"`. Source: Apple feedback.
- 28 `primary-buttons-48`: the primary button on Apply, Paper and Pitch is 48px high or more. Source: Material density.
- 29 `table-not-mounted-while-loading`: while the Paper call is held the page shows its own loading copy ("Loading documents") or a skeleton and no table, and with the call answered by an empty list it shows a different empty sentence ("No documents yet."). A blank loading state, or the same sentence for both, is a FAIL. Source: NN/g.
- 30 `undo-and-reject`: Undo on the CV toolbar and a Coach Reject or "Undo this change" control (DOM, or a JSX label or quoted string in source). Source: Apple undo; Gemini.

App-wide:

- 31 `one-h1-per-screen`: exactly one visible h1 on Home, Paper, the open CV, Apply and Pitch.
- 32 `keyboard-reaches-primary`: Tab reaches the primary action of each surface within 30 presses (30 is this skill's budget, not a standard).
- 33 `no-console-errors`: the signed-in desktop, reduced-motion and 390px passes log no console error, React warning, uncaught exception or failed load. The mocked scenario pages are not counted.
- 34 `first-render-budget`: each route renders its content within 2000 ms of navigation (dev server, warm). The budget is this skill's, set for the shared 8-core machine.
- 35 `spacing-scale`: 95% or more of padding and gap values are on the 4px scale plus the half steps 2, 6, 10, 14.
- 36 `row-density`: Paper rows 40 to 72px; no Apply card title past two lines. The title is the deepest element in the card whose text is the title from the card's aria-label, whatever its tag; a card with no such element, or no cards, is a FAIL. Source: Material density.
- 37 `no-raw-colors`: every computed text, fill and border color equals a semantic design token (the `:root` variables of `globals.css`) within 6 per channel, 12 when translucent. Tailwind palette variables such as `--color-red-600` and `--color-black` are not design tokens, so a palette class fails. Black scrims, SVG fills and gradient stops are not measured here (19 reads gradients). The source test `apps/web/src/test/design-vocabulary.test.ts` covers raw hex in `apps/web/src`.
- 38 `mobile-surfaces-reachable`: at 390x844 the four surface links are in view at 24px or more and the page does not scroll sideways.
