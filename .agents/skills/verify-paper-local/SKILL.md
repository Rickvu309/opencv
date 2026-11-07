---
name: verify-paper-local
description: Check a change to local Paper recovery or IndexedDB durability with PaperLocal and the editor replay.
---

# Verify local Paper recovery

Use this when a change touches the first local copy of typed words, the IndexedDB write in the Paper editor, or a reload that must keep those words.

## Rules

Typed words are still in the editor, the local journal, or the server, so a reload cannot drop them. A save that resolved is still in the journal after an abort. Saved still requires a committed receipt.

These are the three rules of `PaperLocal.tla`. Do not weaken a rule to clear a finding. A run that passes on the today constants is a failure of this check.

## Where the code lives

- `apps/web/src/lib/paper-sync.ts` writes the first recovery copy inside the editor subscription. `openPaperSync` calls `save` from that subscription with no timer in front of it. The guard `paper-local-durable` requires that direct call. The 400ms network debounce stays in `schedule` and is not the recovery copy.
- `apps/web/src/lib/paper-sync-store.ts` exports `indexedDbStore`. `save` waits for the transaction to complete and rejects on abort. Request success is not durability. Reads still use request success. The guard `paper-local-commit` requires the transaction completion for `save`. `paper-sync.ts` re-exports `indexedDbStore` so the model map can name it.

`apps/web/src/lib/PaperLocal.tla.json` maps `Type`, `Reload`, `SendOrRetry`, `DeliverReply`, `LoseReply`, and `ServerFails` to `openPaperSync`. It maps `LocalRequestSuccess`, `LocalCommit`, and `LocalAbort` to `indexedDbStore`. `AcceptDurably`, `GoOffline`, and `Reconnect` are model-only.

## What main did

Commit `a1831b78801edfac3063a7376dc46a72a08fa054` waits 50ms before the first recovery write, and it resolves `save` on `IDBRequest` success. The strict behavior is synced only at the commit named below, and only after the replay keeps words typed inside that window and rejects an aborted write.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla --mutant
pnpm --filter web exec vitest run --config vitest.config.ts src/lib/paper-local-replay.test.ts
```

The first command uses `PaperLocal.cfg`. `JournalOnInput` and `ResolveOnCommit` are TRUE. Those are the target constants. Exit 0.

The second command uses `PaperLocal.mutant.cfg`. Both constants are FALSE. Those are the today constants. Exit 12. The runner discovers that mutant by pairing `PaperLocal.cfg` with `PaperLocal.mutant.cfg`.

Do not add `PaperLocal.today.cfg` as an ordinary config beside the model. `node scripts/tlc.mjs --all` expects every ordinary config to pass, and the today constants violate `WordsNeverLost` and `LocalSuccessMeansDurable`.

The Vitest file replays both gaps against `paper-sync.ts` and `paper-sync-store.ts`. Typing then a reload inside the old 50ms window keeps the words. Request success followed by a transaction abort rejects `save`, and a reload does not show that record.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Paper save and recovery`. The target chart is the one to approve. The today chart is the break.

Show the three TLC results in order. Clean, then the failing today constants, then clean again. Keep that evidence. A pass on the today constants means the check can no longer see a delayed journal or a save that resolves before commit.

## Bounds

One document. One tab. One typed edit. One local transaction. One reload. The network debounce, orphan adoption, keepalive, and the server receipt are outside this check. This check does not prove a crash before the IndexedDB transaction commits, a second tab, or the server head.

## When the code changes

After a change to the files named above, run `/maintain-formal-verification-skill`. Move the sync commit only after the model still matches the code and the replay keeps the typed words. Never weaken a rule to clear a finding. Do not add this model to `verify-paper-save`. `ContentStore.tla` stays the Yjs log model.

Last confirmed sync commit. `51dc1ac8a3440a9836a8cbb53cb80c20cdbd0bf1`
