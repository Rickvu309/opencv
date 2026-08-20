# ADR 0008: A published Proof is a line on the Paper CV

## Context

ADR 0005 kept Proof beside Paper and connected them with `paper.addProofLine` — an explicit Add. Students who published a café shift then landed on a Drive list: Start a CV, Start a letter, I already have a file, and "Start with the CV." The line was not on the page.

## Decision

`/paper` is one A4. Empty is a hairline-dashed page, same proportion as `PaperPage`, no label; click opens a CV. A published Proof appears on that A4 as date plus the same words as `/p/:slug`, in that card's type — not a more professional rewrite. No Add. Paper does not rewrite, ghostwrite, or invent a number. Unpublished, skipped, and empty untitled Proofs stay off the page. Home routing is unchanged. Letter is a second A4 later.

## Rejected

- Add-to-CV as the door.
- Type tabs, Recents/Shared, Start a CV / Draft a letter / I already have a file as the empty state.
- A Proof list or feed on Paper.
- A different sentence than the public card.

## Consequences

Proof stays its own domain (ADR 0005). The canvas reads `proof_pages`. Dump and publish are unchanged.
