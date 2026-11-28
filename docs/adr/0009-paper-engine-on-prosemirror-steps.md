---
status: accepted
---

# The Paper engine runs ProseMirror steps without its view, lays out its own pages, and the server orders every change

Paper should work like a small Google Docs for CVs and Letters: a free A4 page that is the same page on every screen, Word in, Word and PDF out, and Coach suggestions the person accepts on the page and takes back with one Undo. The editor of 2026-11-27 could not keep that promise. A person audit found that Ctrl+A followed by End and a key wiped the whole Paper, Enter left a list, rich paste was dropped, hidden header fields caught the caret, every key took a 200 ms task on a three page CV, bold over several paragraphs bolded one, there was no PDF, and Word lost heading levels and links. Most of these came from the browser's editable text and from a second document model that the editor and the Yjs document translated between.

## Decision

The new core is a pure workspace package, `packages/paper-engine`, built on the headless ProseMirror packages `prosemirror-model`, `prosemirror-state`, `prosemirror-transform`, `prosemirror-history` and `prosemirror-collab`. Nothing outside the package sees a ProseMirror type; callers use the eleven functions in `docs/product/paper/engine.md`.

- **Model.** One flat schema: `doc > block+`. A Block is a text block (title, subtitle, heading, subheading or paragraph, with list and level, align, spacing, keep with next and one right tab stop), a photo, a table, a divider or a page break. Lists are flat, the way Word stores them. A blank CV or Letter is one empty paragraph on an A4 page. The stored JSON is the ProseMirror JSON of this schema, so there is no second model to convert.
- **Commands.** Every edit is one `DocCommand` union, the same for the keyboard, the toolbar, paste, Coach and outside agents. A command runs once, at its origin, and produces concrete steps that carry their ids and text. Coach and agents use a subset and always send `expect`, the exact text they replace; a mismatch is a refusal, never a guess.
- **No `prosemirror-view`.** A hidden textarea receives keys, composition and the clipboard and turns them into commands. The page is painted from our layout, never from editable browser text. Tiptap, BlockNote and Yjs are not used.
- **Own layout in millipoints.** Line and page breaking run on integer millipoints from one generated font metrics table, with bundled line break data, so the browser, the server, the thumbnail and the PDF break on the same lines in every JavaScript engine.
- **Server ordered change log.** Each Paper is a snapshot plus one ordered list of changes with one integer version, written by one writer per Paper. Clients rebase their pending steps with the `prosemirror-collab` protocol. There is no CRDT.
- **History.** Exact Undo comes from `Step.invert`. Ctrl+Z undoes this tab's own groups. The receipt Undo of a Coach or agent change reverts it through mapping, or refuses with "The Paper changed there since".

## Grafts from the other designs

- Five prototypes ran before any engine code: Vietnamese input, font drift, keystroke time, PDF text extraction, and spelling with a screen reader.
- Structural guards: one input path, one write path, layout owns every line break, the engine is pure, and no editor view framework may be imported.
- Integer millipoints in layout and one right tab stop on text blocks, for the role on the left and the dates on the right.
- Text whose place cannot be proved after a conflict or compaction goes to a recovery panel the person can reinsert from. It is never dropped silently.
- Ctrl+P and File, Download PDF both open the server PDF, never the browser print of the app.
- CI gates on deterministic work counts per keystroke; timing is nightly and pull request evidence.

## Conditions

1. **One authoritative accept.** A Coach or agent Suggestion is accepted only through the registry approval on the server. The accepted change, the Suggestion state and the receipt commit in one transaction. The tab where the person clicked receives it as one Undo group. There is no accept path in the browser.
2. **Who may write.** `paper.save` accepts person changes only from the signed in owner's session. The server re-runs each change's commands at its base and refuses steps that do not match them. Ids come from the `Ports.ids` adapter, seeded in tests.
3. **Undo per origin.** Ctrl+Z undoes this tab's groups, including an accepted Coach batch as one group. Undo of a Coach or agent change from anywhere is the receipt Undo.
4. **Pending edits survive.** Pending changes are kept per Paper and per writer in IndexedDB until the server acknowledges them durably. If compaction removed their base, text whose place cannot be proved goes to the recovery panel and is never replayed at stale offsets.
5. **Audit rows are cutover checks.** Every row of the 2026-11-27 audit is a check on the new route before the switch, including the unexplained loss after a menu and Escape, which stays open until it is reproduced or covered.
6. **Deletion is sized from `git ls-files`.** Old core removal is split into pull requests of at most 25 authored files.

## What the prototypes found, and the fallbacks we adopted

All five prototypes passed on Chromium, Firefox and WebKit on Linux. None of the fallbacks breaks a promise.

- **Fonts.** The page, the PDF and Word use Liberation Sans, Liberation Serif, Liberation Mono and Carlito. Caladea is dropped because it lacks 37 Vietnamese code points; a Cambria import maps to Liberation Serif and the import report says so.
- **Paint.** Subpixel text positioning is required. Where an environment snaps glyph advances to whole pixels, each word is painted at its layout x, so line breaks never change. Automation launches Chromium with `--font-render-hinting=slight`.
- **Keystroke bar.** A keystroke is measured from keydown to the next frame. The bar is p95 within 1.5 ms of a bare textarea measured the same way, and max within one frame of it. The prototype measured p95 17.0 ms against 16.5 ms bare; the old editor measured 129 ms.
- **Input.** Treat `insertCompositionText` without a live composition as a plain insert, because Firefox can deliver a plain key that way. The Undo group of a composition follows the caret, not the end of the diff. Moving the focused textarea between pages must not drop keys.
- **PDF.** The server writes PDF with PDFKit, subset CID fonts and ToUnicode maps; three extractors read the exact text, Vietnamese included, in reading order.
- **Spelling.** Spelling ships after the switch. The Vietnamese dictionary is GPL, so how it is delivered is decided before spelling ships.
- **Not testable on Linux.** macOS Telex in Chrome and Safari, Windows Unikey and EVKey in Chrome and Edge, iPhone and Android keyboards, VoiceOver and NVDA are checked on real devices before the switch.
- **Named way out.** If real device input fails, the input and paint layer is swapped for `prosemirror-view` on one long editable page with our page boundaries as decorations, keeping the rest of this engine.

## Considered options

- Write every part ourselves: model, steps, history and collab included. It owns everything, at the cost of rewriting the most tested editor code there is.
- Let the browser lay out text and print the PDF. It is the least code, but it keeps the same page only from Chromium to Chromium, which breaks the rule that the Paper page is the same page on every screen, and it needs a paid printing service.
- ProseMirror headless core with our own layout. Chosen: both reviewers scored it highest, it keeps the same page by construction, and it borrows the hardest parts instead of writing them.

## Consequences

- This supersedes ADR 0004. Concurrent updates are ordered by the server's change log and rebased by `prosemirror-collab`, not merged by Yjs.
- This amends ADR 0008. A Paper is still one document and Word is still a door; the document is now the flat schema above, and PDF is a second door out.
- The old core (the Yjs package, the old rich editor, and the API content and native output modules) was fenced while the rebuild ran and was deleted after the switch, in #2311 to #2327.
- The promises are scenarios in `apps/api/src/scenarios/paper-engine.scenario.test.ts`, marked as expected to fail until the work that keeps each one lands.
- Our own caret, selection, composition, phone selection, accessibility and spelling are ours to maintain. Columns, text wrapping around a photo, and headers and footers are out of scope for this release.
