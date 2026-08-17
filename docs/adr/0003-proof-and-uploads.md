# ADR 0003: Proof replaces write-up; uploads live in My Paper

A write-up was a letter with a different label. A Proof is a running log that can become a shareable page. One struct cannot hold both without lying (empty notes on a letter, paragraph indexes on a dump).

**Decision:** Paper types are CV, letter, and Proof. Callers still see `Paper`. Uploaded CV and cover-letter files are a sibling list on AppState (`uploads`), not a fourth type and not vault documents. The vault keeps pointers the Coach reads (LinkedIn, GitHub, portfolio). A file the person brought cannot be typed in.

The grill that locked this is [`docs/paper.md`](../paper.md).
