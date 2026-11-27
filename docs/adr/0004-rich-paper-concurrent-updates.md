---
status: superseded by 0009
---

# Rich Paper merges concurrent updates on their original Yjs basis

Paper stores rich content as one canonical Yjs editor document. Two tabs share a server epoch but may both have unacknowledged updates. Receive merges a validated remote update into the live document, retaining local updates until the server acknowledges them. A stale reply advances the known server revision and immediately retries the remaining pending update. Visible idle tabs pull every 2.5 seconds without flashing Saving.

Semantic rebase was disabled because the prose adapter reconstructs content from a second text representation. That would flatten rich structure, formatting, tables, photos and editor identities. The old rich client consequently refused any foreign change while local edits were pending, even when Yjs could merge the updates on their shared basis.

We keep semantic rebase disabled and use Yjs merge semantics instead. Before mutating either live or acknowledged state, receive validates both the candidate server document and the combination of live and remote updates through the canonical rich reader. Provenance, kind, revision and epoch checks still apply. Epoch resets with pending input, malformed documents and incompatible schemas remain refused without acknowledging or rewriting recovery bytes. A runtime refusal keeps the existing editor mounted and read-only so the person can select and copy their text; Saved and Word download remain unavailable. Startup recovery of incompatible or divergent checkpoints still refuses rather than inventing a shared basis.

Replaying local rich editor steps or reconstructing rich JSON would introduce another document model and risk changing operation identity. Those approaches are not used. This choice does not resolve application-level simultaneous replacements or guarantee recovery after an incompatible epoch change. It preserves the existing durability gate: Saved requires exact local persistence and server acceptance. This builds on the bounded cumulative journal and idle pull from the fast-typing fix in #1629.
