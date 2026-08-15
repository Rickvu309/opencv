# 02 — Start and write a CV

**What to build:** On deadline night I can start a CV and type on the A4 I will send. From nothing I pick a situation on the gallery wall. From a file I get a built CV beside the upload — we do not pretend we read the PDF. I write on the sheet, not a form with a preview.

**Blocked by:** 01 — One room, pick a paper

**Status:** resolved

- [ ] The unmade CV and New → CV open the eight-situation wall as a Drive mode in the same room. Arrows, Enter, and Escape work. The chosen tile travels into the A4.
- [ ] Format → Where it’s going reopens that wall on this paper. Typed lines stay where blocks remain. A photo does not ride onto a situation with no photo area.
- [ ] I type on the A4. Empty lines show ghosts, not fake content. A + between blocks Reveals a new ghost. I can drag the selected block so page order is reading order.
- [ ] On a phone I see only the sheet — no Edit / Preview switch. Completeness is a quiet percent in the band. Export PDF sits on the band. A photo is a frame on the A4.
- [ ] The empty-room file door creates the uploaded file and a built CV (plain starter structure, not seeded from Profile), skips the gallery, and opens the built CV. The file stays Uploaded.
- [ ] New → Upload and an onboarding drop leave a file on Drive only. They do not open a built letter or yank me into Docs.
- [ ] An existing upload offers Start a CV from this. The file and the built CV stay siblings; deleting one does not destroy the other. An upload never counts as a ready CV.
- [ ] The type word is CV or Resume according to the situation’s audience.
- [ ] Create, theme, section, entry, and upload writes go through `paper.*` on applyAction. `fromProfile` is false on the upload write door. Prove it at that seam.

## Answer

Gallery is a Drive mode. Format reopens it on this CV. Upload write doors use `fromProfile: false`. Blocks drag-reorder via `paper.moveSection`.
