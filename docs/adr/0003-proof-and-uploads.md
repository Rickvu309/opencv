# Proof replaces write-up; uploads live in My Paper

A write-up was a letter with a different label. A Proof is a running dump that can become a shareable page. One struct cannot hold both without lying: empty notes on a letter, paragraph indexes on a dump.

Uploaded CV and cover-letter files are not vault documents. The vault keeps pointers the Coach reads (LinkedIn, GitHub, portfolio). A file the person brought sits in My Paper beside the papers they build, and cannot be typed in.

This extends ADR 0002: callers still see `Paper`. The types are CV, letter, and Proof. Uploads are a sibling list on AppState, not a fourth type.

The grill that locked this is [`docs/paper.md`](../paper.md).
