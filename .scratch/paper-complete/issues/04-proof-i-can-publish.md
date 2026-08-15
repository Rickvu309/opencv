# 04 — Proof I can publish

**What to build:** A Proof is a space I can fill, then a page I can put on the web. I add a note, photo, file, or link without being required to. When I am ready, Arrange is a draft of the real public page; Publish makes a URL; Unpublish takes the page down and leaves the space.

**Blocked by:** 01 — One room, pick a paper

**Status:** resolved

- [ ] A new Proof opens as a space with chips that teach what already counts. I can add a note, photo, file, or link easily. Nothing is required. Logging is not publishing.
- [ ] Notes in the space stay newest-first. Add to CV is quiet and never automatic.
- [ ] Arrange is a draft of the real public page: why plus material in the order I chose. Leaving Arrange keeps the draft.
- [ ] Publish makes one public URL. The public page and the Arrange draft share one layout: name, title, role · dates · link, a why, and material in their order. No hero, no follow, no Contact Me.
- [ ] Unpublish from Docs removes the public URL and leaves the space. Republish is Arrange plus Publish again.
- [ ] A visitor tapping role · dates sees the one-line span and a door to the personal link.
- [ ] The words dump and Prepare do not appear on the space or the band. The band uses Arrange, then Publish.
- [ ] Photo, file, and link extend the existing Proof model and `paper.*` actions — not a second artefact. Publish writes a snapshot; the public page reads that snapshot, not live AppState. Prove create, notes, Arrange, publish, and unpublish at the applyAction and snapshot seams.

## Answer

Notes accept kind photo/file/link. Arrange renders `ProofArticle` (same as `/p/[slug]`). `paper.unpublishProof` plus DELETE on the share route. Dump copy is gone.
