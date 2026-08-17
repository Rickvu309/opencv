# Architecture decisions

Locked choices. Do not reopen them in a feature ticket. Add a new numbered file when a decision changes.

| ADR | Decision |
|---|---|
| [0003](0003-proof-and-uploads.md) | Proof is a paper type. Uploads sit beside papers, not in the vault. |
| [0004](0004-tanstack-start.md) | The app is TanStack Start. `applyAction` stays the write path. |

0001 and 0002 were never checked in. 0003 extends the intent of 0002 (callers still see `Paper`).
