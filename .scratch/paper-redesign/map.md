# My Paper redesign

## Destination

A written visual/interaction spec for **My Paper** — Drive, Docs, the gallery, an opened CV, letter, and Proof **space**, the published Proof page, and the **personal link** — deep in space and craft, seamless to move through, easy on deadline night. The spec lives at `.scratch/paper-redesign/spec.md` and is writing plus occasional references to another product, site, or app. Someone can hand it off and iterate. It is not a build.

## Notes

- Domain: Paper. Nouns and jobs in `CONTEXT.md` and `docs/paper.md` stay. Drive then Docs stays as two modes; layout of every My Paper screen is open. `DESIGN.md` is evidence, not a lock — colour, type, and chrome may be proposed and rejected later.
- Mix of leads: the opened paper is the output — you edit the A4 / page (chatPRD-like canvas, not a form that paints a preview). Resume.io / Kickresume stay references for “the sheet is an object” (pages, export on it), not for form-paints-preview. Teal only on Application, not on Drive.
- Depth: spatial (the paper is an object) + craft (colour, type, motion that earn their place). Not denser forms for their own sake. Motion values live in [spec Motion](spec.md#motion). A scan Reveal is forbidden until extract is real.
- Every HITL ticket: `/grilling` and `/domain-modeling`. Layout tickets also `/better-layout` and `/impeccable` (shape / layout). Motion ticket: `/animation-vocabulary` to name the effect, then `/animate` for values — not production code until the spec is accepted.
- Grill hard. Ask as many frontier questions as the tree will bear. Do not close a ticket on a short “agree.” If the session needs an answer the human is not here to give, spawn a Claude Fable 5 agent (`claude-fable-5-thinking-max`) to answer; do not invent the human’s taste.
- Token, spacing, and ratio details are advisor work (`/better-layout`, `/better-colors`, `/impeccable`, `/animate`). Do not grill the human for pixel values.
- Spec tone: easy, written, sometimes a reference screen. No Figma-first pass.
- When a grill ticket resolves, write the lock into that ticket’s Answer *and* into [spec.md](spec.md). Do not put visual locks into `docs/paper.md`.
- Plan, don't do. Other product screens are later tickets, not this map.

## Decisions so far

- [Reference screens for My Paper](issues/01-reference-screens.md) — List is a picker you leave; the CV is an object (pages, spacing, export on the sheet); Docs types on the page; personal pages are a record, not a CMS. Poster-grid libraries (Kickresume cards, template walls) stay rejected. Detail: [reference-screens.md](research/reference-screens.md).
- [Drive as a place you pick](issues/02-drive-as-a-place-you-pick.md) — Sheet-edge stack in one room; empty is one unmade CV on the list’s leading edge; New + filter sticky; uploads share the row with a quieter mark. Spec: [Drive](spec.md).
- [The Drive–Docs seam](issues/03-the-drive-docs-seam.md) — One room; band stays and changes job; shared-element name→title and slab→sheet; gallery is a Drive mode; inbound lands in Docs; you edit the A4 (the output). Spec: [Drive–Docs seam](spec.md).
- [Paper craft: colour and type](issues/04-paper-craft.md) — Colour separates desk from output; A4 stays black-on-white; Proof share may be hotter; chrome one sans, sheet may have a second face; warm ink on New / unmade CV; upload is an honest starting-point door. Spec: [Craft](spec.md).
- [Gallery wall](issues/05-gallery-wall.md) — Create wall of eight A4 sheets, caption under, audience-first, equal; pick travels into Docs; Format bar reopens the same wall on this paper. Spec: [Gallery](spec.md).
- [Opened CV: the A4 is the canvas](issues/06-opened-cv.md) — Type on the sheet, line = field, `+` adds a block, no form/preview split; Format on the desk; add Reveals, reorder Layout-animates. Spec: [Opened CV](spec.md).
- [Letter and Proof dump: the page is the work](issues/07-letter-and-proof-dump.md) — Letter is standard paper (letter/email page, not a CV grid). Proof is an inviting **space** of proofs. Never say dump on screen. Email scan later. Spec: [Letter](spec.md) / [Proof space](spec.md).
- [Published Proof page](issues/08-published-proof-page.md) — **Arrange** (live on a draft page) then **Publish**. Curated, one layout, large photos, their words. Prepare retired on the band. Spec: [Published Proof](spec.md).
- [Personal link](issues/09-personal-link.md) — **Span record** of published Proofs (work dates, not app days). No GitHub grid. Spec: [Personal link](spec.md).
- [What My Paper motion is for](issues/10-what-my-paper-motion-is-for.md) — Instant for typing/caret/hover/keyboard; shared-element Drive↔Docs and gallery pick; Reveal on add block / first row; Layout animation on reorder; scan Reveal forbidden until extract is real. Spec: [Motion](spec.md#motion).
- [Upload as a starting point](issues/11-upload-as-a-starting-point.md) — File stays Uploaded; write doors open a built CV with plain ghost starters (no Profile, no gallery); letter and onboarding are file-only; extract later fills that same A4. Spec: [Upload](spec.md#upload).
- `CONTEXT.md` **Uploaded file** now says starting a built CV does not turn the file into a paper. Upload preview stays the Drive expand (file click, not the write door).

## Not yet specified

- How the Coach thumbnail inherits the new Docs look.
- How `DESIGN.md` absorbs the spec once accepted.
- Format-bar accent on a CV — leftover; advisor if a layout ticket needs it.
- Connect email / scan a week / Granola — later map. No fake inbox scan.
- Graphs and “anything” on a Proof — later door on the space.

## Out of scope

- Profile, Pitch, Search, Application, Coach, Discover — later tickets; they may inherit chrome, they are not chapters here.
- Implementation, leftover bugs (onboarding file bytes, cover-letter upload kind).
- Reopening Paper nouns (Proof, types, sendable-CV north star, no social network, no streaks).
- Real extract / AI / API, and real email sync — later. Doors may exist; fake scans are out.
- Editing a paper on the Application board.
