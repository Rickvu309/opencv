# Paper

**Track:** Commodity — cloned from Resume.io / Kickresume (live A4 page, PDF export). Concept reference: [docs/paper.md](../paper.md).

**Job:** deadline night — a user with an application due tonight leaves with a CV they can send.

**Layout:** Page canvas at `/paper` (band title only, one A4). Opened document at `/paper/$paperId` (primary: Export). The dock must not cover either ([layout.md](../design-system/layout.md)).

## Concept

Paper is one A4 CV. Empty is a hairline-dashed page. A published Proof is one line on that page — the same words as `/p/:slug`. No Add. Letter is not a tab and is not an editor on this canvas. In the rail, Paper sits under **Prepare**. Proof stays its own domain ([ADR 0005](../adr/0005-proof-own-domain.md), [ADR 0008](../adr/0008-published-proof-on-paper-cv.md)); the CV reads the published snapshot, it does not rewrite it.

## Screens

- Reached from the Prepare group in the rail, from a Coach card, or from Apply when tailoring a copy ([flows.md](../flows.md)).
- `/paper` — band titled **Paper** only. No type tabs. No Recents/Shared. No "Start a CV". No "Draft a cover letter". No Row list. No nested sheet. One A4 on a muted stage. Empty: a hairline-dashed A4, same proportion as `PaperPage`, no label; click opens a CV page. Has a published Proof: that A4 is the CV, date plus their line already on it, same words and the same type as `/p/:slug` (13 muted date, 15/510 words). If the A4 looks more professional than the public card, the A4 is wrong. Click opens the editor. Unpublished, skipped, and empty untitled Proofs stay off the page; the dashed A4 stays. Letter is a second A4 later, not a tab on this canvas.
- `/paper/$paperId` — the opened document: back, editable title, type label, export, then the format bar, then a muted stage with the white A4. The page is the editor. CV: blocks (name, contact, experience, education, skills) edited in place. Published Proof lines are read-only on the page — date and their words, never a rewritten bullet. Add and remove roles, results, schools, and skills on the page; Enter adds the next result or skill, Backspace removes an empty extra line. Page actions do not print. Select a line for Copy or Add to Coach. Opened CV chrome includes delete (confirm overlay naming the noun, then back to `/paper`).
- Format bar owns density (`paper.setTheme`) and section hide (`paper.updateSection`). Completeness is a fact in the format row on an open CV ("N of the profile lines are on this page"), never a hero.
- Export is PDF via the print dialog. Documents are strictly black on white. Print hides rail, dock, band, and format bar.

## Data

`papers`, `files` (purpose `upload`) ([data.md](../data.md)). The canvas also reads `proof_pages` for the published line.

## Commands

| Command | Agent | What |
|---|---|---|
| `paper.create` | yes | Kind, template, optional `fromProfile` seed. Clicking the dashed A4 creates a CV |
| `paper.rename` | yes | Title |
| `paper.updateBlock` | yes | Exactly one block (`name`, `contact`, `experience`, `education`, `skills`, `proofLines`, `paragraphs`, or `situation`). Merges that key; never a whole-document rewrite while the user may be typing |
| `paper.updateSection` | yes | Hide or show a section, keep content |
| `paper.setTemplate` / `paper.setTheme` | yes | Situation; density and accent |
| `paper.duplicate` | yes | The tailoring primitive: copy, then edit the copy |
| `paper.addProofLine` | yes | Leftover write. The canvas does not use it — published Proofs appear from `proof_pages` |
| `paper.remove` | yes | Destructive: confirm first |
| `paper.uploadFile` / `paper.removeFile` | no | Bring or remove a file |

## AI

`ai.server.ts`: sharpen a bullet into a result line (a number only if the user gave one); draft a letter from the profile and an opening. Sharpen is a Coach tool that returns the rewritten line; the Coach then writes it with `paper.updateBlock`. Paper does not rewrite, ghostwrite, or invent a number for a Proof line.

## Coach behaviour

Builds a first CV from the profile, edits line by line (`paper.updateBlock`), duplicates before tailoring, and suggests tighter density before cutting content when a CV runs long. On an opened CV the dock is the same Coach as `/coach`, with this paper in context, and the A4 updates when a `paper.*` tool succeeds. Select a line → Copy or Add to Coach; the excerpt is context for the next turn, not a message. Not a ChatPRD studio. Not a CV-only thread. Not typing the CV in a bubble.

## Empty state

One hairline-dashed A4. No label. Click opens a CV page. Not a row list. Not "That's all."

## Out of scope

Parsing uploads, a letter editor on this canvas, type tabs, Add-to-CV, a Proof list or feed on Paper, STAR-on-Paper, Fit scores, nested sheets. Proof dump and publish stay in [proof.md](proof.md).
