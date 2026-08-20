# ADR 0005: Proof is its own domain beside Paper

## Context

Paper (CV and cover letter) is a commodity we clone from the resume-builder category: document in, PDF out. Proof is OpenPath's signature mechanism — a user builds up evidence of work and skills over time with AI support, then publishes and shares it — and it is expected to grow into invitation, sharing, and social mechanics. One domain cannot serve both without lying: a document has a body and an export; evidence has a log, a lifecycle, and an audience.

## Decision

Proof is its own feature module and domain (`src/features/proof/`, tables `proofs`, `proof_entries`, `proof_pages`), beside Paper, not a paper type. Sharing is a separate substrate (`src/features/share/`, tables `handles`, `shares`) that Proof publishes through: per-Proof pages at `/p/:slug`, the personal page at `/u/:handle`, and a `shares` table whose capability field (`view` now; `vouch`, `invite` reserved) is the extension point for future mechanics. The two domains connect through the published snapshot: Paper reads `proof_pages` and puts those words on the A4. `paper.addProofLine` is not the user path. Superseded on the connection by [ADR 0008](0008-published-proof-on-paper-cv.md); Proof remains its own domain.

## Rejected

- Proof as a third paper type: drags evidence through document semantics and pins the growth vector to an export pipeline.
- Building vouch/invite mechanics now: v1 ships log, arrange, publish, view; the schema reserves the room so later mechanics are additions, not rewrites.

## Consequences

Paper stays simple and swappable, faithful to its clone references. Proof can evolve its lifecycle, its AI interviewer, and its social surface without touching document code. The share substrate serves any future entity that wants an audience, not just Proof.
