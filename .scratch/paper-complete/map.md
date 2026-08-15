# Complete My Paper

Five vertical slices. Work the frontier: any ticket whose blockers are done. That starts at **One room, pick a paper**.

Product locks: `docs/paper.md`. Visual locks: `.scratch/paper-redesign/spec.md`. Build lock: [spec.md](spec.md).

## Notes

- One ticket per session. Follow that ticket’s criteria; do not batch the rest of Paper.
- Implementation already started and drifted. Each ticket is the remaining code, not a greenfield.
- **Letter page** and **Proof I can publish** can run in parallel after ticket 01.
- Motion (shared element, Reveal, reduced motion) lives inside 01 and 02, not as its own ticket.

## Decisions-so-far

- Tickets approved 16 Aug 2026: five slices, merged from eight. Upload lives inside **Start and write a CV**, not its own ticket.
- Writes stay on `paper.*` via applyAction. Public pages and the span record stay on snapshot / span helpers. No third test seam.
- 16 Aug 2026: all five tickets implemented. Drive and Docs share one `PaperToolbar`. Gallery and letter chooser are Drive modes. Proof notes gained photo/file/link; Arrange renders the public article; Unpublish exists. Personal link uses `sentenceForSite`.
- 16 Aug 2026: **One room, pick a paper** tightened. `roomMode` keeps an `id` on Docs (no Drive flash). Travel only on open/back.
- 16 Aug 2026: **Start and write a CV**. Gallery tile and A4 share `sheetTransitionName`. Upload write door is `fromProfile: false` beside the file. `+` on the A4 Reveals a ghost section.

## Fog

None on nouns. Do not reopen Paper, Drive, Docs, CV, letter, or Proof.

## Tickets

| # | Ticket | Blocked by | Status |
| --- | --- | --- | --- |
| 01 | [One room, pick a paper](issues/01-one-room-pick-a-paper.md) | — | resolved |
| 02 | [Start and write a CV](issues/02-start-and-write-a-cv.md) | 01 | resolved |
| 03 | [Letter page](issues/03-letter-page.md) | 01 | resolved |
| 04 | [Proof I can publish](issues/04-proof-i-can-publish.md) | 01 | resolved |
| 05 | [Personal link](issues/05-personal-link.md) | 04 | resolved |
