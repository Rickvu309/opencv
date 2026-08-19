# Paper

**Track:** Commodity — cloned from Resume.io / Kickresume (template gallery, live A4 page, PDF export) and Teal (tailor a copy per job). Concept reference: [docs/paper.md](../paper.md).

**Job:** deadline night — a user with an application due tonight leaves with a CV they can send.

**Layout:** Drive list at `/paper` (primary: Start a CV), Opened document at `/paper/$paperId` (primary: Export). The dock must not cover either ([layout.md](../design-system/layout.md)).

## Concept

A flat list of documents (Drive), and an opened document you write on directly (Docs). Two kinds: CV/Resume and cover letter. In the rail, Paper sits under **Prepare**. Proof stays its own domain and is not a rail row ([ADR 0005](../adr/0005-proof-own-domain.md), [proof.md](proof.md)). You edit the A4 itself — blocks live on the page; there is no form that paints a preview. Uploads are a starting point: the file stays an uploaded file (preview and download only), and a built CV is created as a sibling; no parsing.

## Screens

- Reached from the Prepare group in the rail, from a Coach card, or from Apply when tailoring a copy ([flows.md](../flows.md)).
- `/paper` — Drive list: Name / Type / Updated columns from `sm`, mixed newest first. Type word (CV / Resume / Cover letter / Uploaded). Optional type filter; Uploaded is files only. Uploaded files sit in the same list as built papers, not a second section. The template gallery replaces the rows in the content slot; it does not append below or open as a modal. Gallery cards are situation cards (type word + one line), not thumbnails. Proof is a child of this room, not a row in this list. No folders, no thumbnail grid. Row menu: open, duplicate, delete; "Start a CV from this" on uploaded rows. Back from an opened document returns here, not to Chat.
- `/paper/$paperId` — the opened document: back, editable title, type label, export, then the format bar, then a muted stage with the white A4. The page is the editor. CV: blocks (name, contact, experience, education, skills, Proof) edited in place, ghost starters when empty. Add and remove roles, results, schools, and skills on the page; Enter adds the next result or skill, Backspace removes an empty extra line. Page actions do not print. Select a line for Copy or Add to Coach (the excerpt rides the next Coach turn; the A4 stays the editor). Letter: situation chooser first in the content slot (posted job, internship, speculative, scholarship — seeds ghost placeholders, never real content), then the black-on-white page, paragraph by paragraph. Opened CV chrome includes delete (confirm overlay naming the noun, then back to `/paper`).
- Template gallery on CV create: eight situations shown at once (Vietnamese employer, internship/first role, academic/scholarship, part-time/service, one page, abroad/ATS, technical, design/portfolio). The word on the document (CV or Resume) follows the template's audience. Format bar owns density (`paper.setTheme`) and section hide (`paper.updateSection`). Completeness is a fact in the format row on an open CV ("N of the profile lines are on this page"), never a hero, never on list rows.
- Export is PDF via the print dialog. Documents are strictly black on white. Print hides rail, dock, band, and format bar.

## Data

`papers`, `files` (purpose `upload`) ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `paper.create` | yes | Kind, template, optional `fromProfile` seed |
| `paper.rename` | yes | Title |
| `paper.updateBlock` | yes | Exactly one block (`name`, `contact`, `experience`, `education`, `skills`, `proofLines`, `paragraphs`, or `situation`). Merges that key; never a whole-document rewrite while the user may be typing |
| `paper.updateSection` | yes | Hide or show a section, keep content |
| `paper.setTemplate` / `paper.setTheme` | yes | Situation; density and accent |
| `paper.duplicate` | yes | The tailoring primitive: copy, then edit the copy |
| `paper.addProofLine` | yes | Put a published Proof onto a CV as one line — explicit, never automatic |
| `paper.remove` | yes | Destructive: confirm first |
| `paper.uploadFile` / `paper.removeFile` | no | Bring or remove a file |

## AI

`ai.server.ts`: sharpen a bullet into a result line (a number only if the user gave one); draft a letter from the profile and an opening. Sharpen is a Coach tool that returns the rewritten line; the Coach then writes it with `paper.updateBlock`.

## Coach behaviour

Builds a first CV from the profile, edits line by line (`paper.updateBlock`), duplicates before tailoring, and suggests tighter density before cutting content when a CV runs long. On an opened CV the dock is the same Coach as `/coach`, with this paper in context, and the A4 updates when a `paper.*` tool succeeds. Select a line → Copy or Add to Coach; the excerpt is context for the next turn, not a message. It cannot edit an uploaded file and says so — the move is "Start a CV from this". Not a ChatPRD studio. Not a CV-only thread. Not typing the CV in a bubble.

## Empty state

"Start with the CV." One primary door; upload is the quiet secondary ("I already have a file" creates the file plus a built CV sibling, skipping the gallery). Gallery: "Where is this CV going?" Letter chooser: "Who is this letter for?"

## Out of scope

Parsing uploads, letter template skins (letters stay black-on-white), editing on Application cards or in chat bubbles (those surfaces open `/paper/$paperId`), Proof (its own feature: [proof.md](proof.md)).
