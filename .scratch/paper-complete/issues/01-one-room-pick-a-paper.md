# 01 — One room, pick a paper

**What to build:** My Paper is one room. I pick tonight’s paper from a sheet-edge stack; I open it without the list and the paper feeling like two apps. The sticky band stays. Empty Drive is one unmade CV plus a quieter file door — not a menu of equal starts.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] Empty Drive shows one unmade CV on the same leading edge the first row will use, plus a quieter “I already have a file” door. No Ask Coach in the empty room.
- [ ] A populated Drive is the same stack with tighter air: name, type word, and updated on a sheet-edge row. Not a poster grid. Not a table with column headers.
- [ ] Type filter appears only when more than one type is present. New sits at the leading edge (CV, Cover letter, Proof, Upload) as a control, not a fake row.
- [ ] An uploaded file uses the type word Uploaded and a quieter mark. Completeness never appears on a Drive row.
- [ ] Drive and Docs are two modes of one shell. The band stays mounted and changes job. Opening a built paper travels name → title and slab → sheet; Back is the reverse and always lands on Drive.
- [ ] A deep link into an opened paper lands in Docs with no Drive flash.
- [ ] Reduced motion skips travel and lands instantly. Typing, Tab, and hover colour stay instant even when motion is allowed.
- [ ] The screen name is My Paper. The words dump, Prepare, Papers, and My Papers do not appear as headings or band labels.
- [ ] Every create, rename, and open-path write goes through `paper.*` on applyAction. Prove it at that seam, not in the DOM.

## Answer

One `PaperToolbar` stays mounted. `roomMode` treats an `id` in the URL as Docs even before the paper is found, so a deep link never paints Drive. Opening a built row and Back travel (name→title, slab→sheet); create, Format, and a land do not. Reduced motion skips travel.

## Verify

- Empty `/paper`: unmade CV + quieter file door. No New, no filter, no Ask Coach.
- Open a built row: name and slab travel into the title and sheet. Back reverses to Drive.
- Open `/paper?id=` for an existing paper: Docs, no list flash, no travel.
- `prefers-reduced-motion: reduce`: instant land. Typing stays instant.
