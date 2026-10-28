# verify-app-ui properties

The list the checker measures. `SKILL.md` links here.

Ids 01 to 30 are the research check numbers. 31 to 38 are app-wide checks the signed-in tour adds. 39 to 44 are the design text rules, and their pinned phrases live in `scripts/lib/copy.json`. A heuristic is a word list or threshold that can misjudge; it says so in its rule text. Search the id in `scripts/lib/checks-content.mjs` (01 to 13) or `scripts/lib/checks.mjs` (14 to 44).

Writing and logic:

- 01 `product-nouns`: chrome may say Job. Opportunity and Thread fail. Email, document and profile stay banned. Exempt: a short goal chip that starts with A or An, the "Connect email, optional" row, the account menu label "<name>, profile and settings", the Paper labels in `legacyNounLabels`, and the Inbox strings `inboxConnectTitle`, `inboxConnectPromise`, `inboxEmptyTitle`, `inboxScanTitle`, plus `{n} emails from {c} companies so far`. Source: ADR-0002.
- 02 `one-composer-placeholder`: The Coach page, the Thread and the Paper Coach float use one placeholder. Source: Apple writing.
- 03 `button-labels-act`: no Click here, Learn more, OK (heuristic; a joke label cannot be decided). Source: Apple writing.
- 04 `coach-error-not-raw`: the tour sends twice, once with the api answering 404 `USER_NOT_FOUND "User not found."` and once with the connection refused. Each must show an error in a live region, and neither may show the raw message or a transport error such as Failed to fetch. No error shown is a FAIL. Source: Apple feedback.
- 05 `no-other-product-names`: no social product name (Instagram, TikTok, Snapchat, Facebook, Twitter, YouTube, Pinterest, WhatsApp, Linktree). Integrations such as GitHub and Gmail are not matched. Connect Gmail is allowed. Source: Apple writing.
- 06 `starter-cv-name`: a new CV's name field placeholder is Name, and the title is not Your name. Source: NN/g empty states.
- 07 `pitch-starter-no-metric`: Pitch coming-soon copy has no percentage, no "N percent", and no add-to-cart. Preview text marked aria-hidden is not counted. Source: NN/g hallucinations.
- 08 `confirm-before-write`: a JSX label or quoted string Approve and Deny exists in the Coach features (source read; comments and type names do not count; the scripted Coach never writes). Source: shadcn Confirmation; Gemini.
- 09 `tool-line-names-object`: a Coach step status line that is not an error names Apply, CV, Letter, Proof, Pitch, Job or card (case-sensitive; driven with a read turn, not a write). Source: shadcn AI Elements.
- 10 `empty-board-one-empty-state`: the tour deletes the jobs through the api, reloads Apply, and requires 0 cards and exactly one empty state. Closed is not a visible heading. A board that was not confirmed empty is a FAIL. Source: NN/g.
- 11 `loading-not-empty`: while the Paper call is held the page says "Loading documents" or "Loading..." and not "Start a document". Source: NN/g.
- 12 `unpublished-banner-has-publish`: Pitch is coming soon and does not show a Hit Publish banner. The check fails only when that banner is present without a Publish button. The tour does not look for Publish. Source: NN/g.
- 13 `fit-not-bare-number`: a percentage on a board card passes only with a basis phrase (because, based on, from your, matches your) inside that same card; a percentage outside any card fails. Source: NN/g.

Structure:

- 14 retired with the Home page. The id is not reused.
- 15 `cv-widest-coach-beside`: with the Coach panel closed, the CV editor is the widest region and no second Coach float covers the sheet (at 1440 wide). An open panel belongs to #377. Source: Cursor; Linear.
- 16 `apply-five-stages-no-hscroll`: every stage in `JOB_STAGES` (`packages/domain/src/job.ts`, read by `assumes.mjs`) except closed is a visible lane heading at 1440x900, Closed is not, and the board does not scroll sideways. A lane is the `data-slot="board-lane"` element with its `data-stage`. An unreadable stage list is STALE unless a lane check already FAILs. The 390 pass skips this property because the lanes scroll there. Source: the Apply board.
- 17 `search-key-hint`: the Search button has a `kbd` inside it and Ctrl-K opens the dialog. Source: Raycast.
- 18 `paper-no-disabled-filter`: no Paper control says Coming soon. The Proof card is a link, not a disabled control. Source: Apple feedback.

Visual craft:

- 19 `light-field-sparse-accent`: body luminance 0.85+; no dark or tinted decorative fill of 6000px2 or more, including gradients (a gradient that fades to transparent is a photo scrim and is skipped). Heuristic. Source: Refactoring UI.
- 20 `text-contrast`: 4.5:1, or 3:1 at 24px (18.66px bold). Skipped: text over images and gradients, disabled controls, aria-hidden text and svg. Source: WCAG 1.4.3.
- 21 `target-size-24`: every link and button 24x24, or a 24px circle that touches no other target; controls that are hidden until hover are not measured. Source: WCAG 2.5.8.
- 22 `apply-dot-count-or-absent`: the Apply link is found by the accessible name Apply. It has no dot, or the dot has a count or an accessible name (an aria-hidden dot has none). A missing Apply link is a FAIL. Source: Apple feedback.
- 23 `stage-word-plus-dot`: every `JOB_STAGES` stage except closed has a visible lane heading. Closed is not a heading until Hidden columns. No stage word or count is pinned. Source: the Apply board.

Motion:

- 24 `motion-tokens`: every computed transition and animation runs 150 ms or 280 ms on the toured screens, and no `duration-N` class or `Nms` value in the signed-in feature folders (every folder of `apps/web/src/features` except landing, auth and seed, listed by `featureFolders` in `scripts/lib/assumes.mjs`, so a new folder is scanned with no edit) or routes source is off-token. Pitch and Proof live in coming-soon. Looping spinners and skeletons are skipped. Source: `globals.css`; the program motion rule.
- 25 `reduced-motion`: with reduce, nothing over 1 ms runs, scroll is not smooth, and the command palette open transition uses the panel duration token. There is no story timer to find. Source: WCAG 2.3.3.
- 26 `no-text-reveal`: no app file imports text-reveal (source read). Source: Apple layout.

Accessibility and performance:

- 27 `alerts-have-role`: the Coach error sits in a live region, no red text outside one, the conflict banner keeps `role="alert"`. Source: Apple feedback.
- 28 `primary-buttons-32`: the primary button on Apply, Paper and Pitch is 32px high or more. The kit glow button is h-8. The button on each surface is the one with `data-primary-action` (`SEL.primary` in `scripts/lib/assumes.mjs`): New job on Apply, New on the Paper library, Get early access on Pitch. A surface with no marked button is STALE, and the vitest `verify-assumptions` fails first. Source: the design kit.
- 29 `table-not-mounted-while-loading`: while the Paper call is held the page shows its own loading copy ("Loading documents") or a skeleton and no table, and with the call answered by an empty list it shows a different empty sentence ("Start a document"). A blank loading state, or the same sentence for both, is a FAIL. Source: NN/g.
- 30 `undo-and-reject`: Undo on the CV toolbar and a Coach Reject or "Undo this change" control (DOM, or a JSX label or quoted string in source). Source: Apple undo; Gemini.

App-wide:

- 31 `one-h1-per-screen`: exactly one visible h1 on the start page, Paper, the open CV, Apply and Pitch. The shell panel title is not an h1. Pitch's only h1 is the coming-soon promise. The page name is not an h1.
- 32 `keyboard-reaches-primary`: Tab reaches the primary action of each surface within 30 presses (30 is this skill's budget, not a standard). The primary is the element marked `data-primary-action`, or anything inside it. On `/coach` that is the Add control of the composer; Message Coach is not required. Pitch's primary is Get early access.
- 33 `no-console-errors`: the signed-in desktop, reduced-motion and 390px passes log no console error, React warning, uncaught exception or failed load. The mocked scenario pages are not counted.
- 34 `first-render-budget`: each route renders its content within 2000 ms of navigation (dev server, warm). The budget is this skill's, set for the shared 8-core machine.
- 35 `spacing-scale`: 95% or more of padding and gap values are on the 4px scale plus the half steps 2, 6, 10, 14.
- 36 `row-density`: no Paper card name and no Apply card title past two lines. The Paper library is a card grid since #396 (`paper-library.tsx`, `PaperCard`), so the old 40 to 72px row band had no rows to measure and the line read `Paper rows ;`. A Paper card is the button named "{name}, {edited}" whose two spans hold those texts; none found is a FAIL. The card's accessible name is "{title}, {company}". The title is the deepest element in the card whose text is that title, whatever its tag; a card with no such element, or no cards, is a FAIL. Source: Material density.
- 37 `no-raw-colors`: every computed text, fill and border color equals a semantic design token (the `:root` variables of `globals.css`) within 6 per channel, 12 when translucent. Tailwind palette variables such as `--color-red-600` and `--color-black` are not design tokens, so a palette class fails. Black scrims, SVG fills and gradient stops are not measured here (19 reads gradients). The source test `apps/web/src/test/design-vocabulary.test.ts` covers raw hex in `apps/web/src`.
- 38 `mobile-surfaces-reachable`: at 390x844 the drawer is open and Inbox, Coach, Jobs, Paper, Apply and Pitch are in view at 24px or more. The page does not scroll sideways. The count stays six because the shell already lists Inbox.

Design text, properties 39 to 44. Phrases are pinned in `scripts/lib/copy.json`.

- 39 `brand-wordmark`: chrome never contains OpenCV. The brand is the mark plus lowercase opencv. The same 39 to 44 rules also run on `/settings` (desktop, reduced motion, and 390). Those snaps stay off the four surfaces in check 38.
- 40 `one-glow-primary`: each toured view, including the 390px pass and the Inbox connect screen, has at most one control wearing the glow utility. The Inbox follows its pen frames and wears no glow.
- 41 `no-dash-in-copy`: chrome has no em dash, en dash, or middle dot.
- 42 `toggle-enabled-disabled`: a toggle label is Enabled or Disabled. On, Off, and Connected fail.
- 43 `title-before-company`: a job line does not start with "at" and no title.
- 44 `no-exclamation`: chrome has no exclamation mark and does not say Oops.
