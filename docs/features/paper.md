# Paper

**Track:** Commodity — cloned from Resume.io / Kickresume (template gallery, live A4 page, PDF export) and Teal (tailor a copy per job). Concept reference: [docs/paper.md](../paper.md).

**Job:** deadline night — a user with an application due tonight leaves with a CV they can send.

## Concept

A flat list of documents (Drive), and an opened document you write on directly (Docs). Two kinds: CV/Resume and cover letter. You edit the A4 itself — blocks live on the page; there is no form that paints a preview. Uploads are a starting point: the file stays an uploaded file (preview and download only), and a built CV is created as a sibling; no parsing.

## Screens

- `/paper` — flat rows: name, type word (CV / Resume / Cover letter / Uploaded), updated. Optional type filter. No folders, no thumbnail grid. Row menu: open, duplicate, delete; "Start a CV from this" on uploaded rows.
- `/paper/$paperId` — the opened document: back, editable title, type label, export. The page is the editor. CV: blocks (name, contact, experience, education, skills) edited in place, ghost starters when empty. Letter: situation chooser first (posted job, internship, speculative, scholarship — seeds ghost placeholders, never real content), then the black-on-white page, paragraph by paragraph.
- Template gallery on CV create: eight situations shown at once (Vietnamese employer, internship/first role, academic/scholarship, part-time/service, one page, abroad/ATS, technical, design/portfolio). The word on the document (CV or Resume) follows the template's audience. Format bar owns accent and density.
- Export is PDF via the print dialog. Documents are strictly black on white.

## Data

`papers`, `files` (purpose `upload`) ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `paper.create` | yes | Kind, template, optional `fromProfile` seed |
| `paper.rename` | yes | Title |
| `paper.updateBlock` | yes | One block or line on the page — never a whole-document rewrite while the user may be typing |
| `paper.updateSection` | yes | Hide or show a section, keep content |
| `paper.setTemplate` / `paper.setTheme` | yes | Situation; density and accent |
| `paper.duplicate` | yes | The tailoring primitive: copy, then edit the copy |
| `paper.addProofLine` | yes | Put a published Proof onto a CV as one line — explicit, never automatic |
| `paper.remove` | yes | Destructive: confirm first |
| `paper.uploadFile` / `paper.removeFile` | no | Bring or remove a file |

## AI

`ai.server.ts`: sharpen a bullet into a result line (a number only if the user gave one); draft a letter from the profile and an opening. Both exposed to the Coach as tools.

## Coach behaviour

Builds a first CV from the profile, edits line by line (`paper.updateBlock`), duplicates before tailoring, and suggests tighter density before cutting content when a CV runs long. It cannot edit an uploaded file and says so — the move is "Start a CV from this".

## Empty state

"Start with the CV." One primary door; upload is the quiet secondary ("I already have a file" creates the file plus a built CV sibling, skipping the gallery). Gallery: "Where is this CV going?" Letter chooser: "Who is this letter for?"

## Out of scope

Parsing uploads, letter template skins (letters stay black-on-white), editing on Application cards or in chat bubbles (those surfaces open `/paper/$paperId`), Proof (its own feature: [proof.md](proof.md)).
