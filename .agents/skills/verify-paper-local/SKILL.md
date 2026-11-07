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

- `apps/web/src/lib/paper-sync.ts` writes the first recovery copy inside the editor subscription, before that callback returns. `rememberLocal` appends the document state to the synchronous journal. `openPaperSync` still calls `save` from that subscription with no timer in front of it. The guard `paper-local-durable` rejects a timer in front of `save`, including a timer written directly in the subscription callback. The 400ms network debounce stays in `schedule` and is not the recovery copy.
- `apps/web/src/lib/paper-sync-journal.ts` stores that journal in `localStorage` under one key per document and tab. Each entry keeps its server basis and epoch. Recovery merges updates from the same epoch and rebases older epochs through `PaperClient.adopt`. Failed adoption retains the journal and reports a stuck merge. Compaction keeps epochs separate. An entry is deleted only after the IndexedDB transaction has completed and an accepting server receipt covers that entry's sequence. A reset or a stale receipt does not acknowledge the entry. Quota and a denied store return `quota` or `denied` and keep the previous journal value. The journal does not set status to Saved.
- `apps/web/src/lib/paper-sync-store.ts` exports `indexedDbStore`. `save` waits for the transaction to complete and rejects on abort. Request success is not durability. Reads still use request success. The guard `paper-local-commit` requires the transaction completion for `save`. `paper-sync.ts` re-exports `indexedDbStore` so the model map can name it.

`apps/web/src/lib/PaperLocal.tla.json` maps `Type`, `Reload`, `SendOrRetry`, `DeliverReply`, `LoseReply`, and `ServerFails` to `openPaperSync`. It maps `LocalRequestSuccess`, `LocalCommit`, and `LocalAbort` to `indexedDbStore`. `AcceptDurably`, `GoOffline`, and `Reconnect` are model-only.

## What main did

Commit `a1831b78801edfac3063a7376dc46a72a08fa054` waits 50ms before the first recovery write, and it resolves `save` on `IDBRequest` success. The replay must keep words typed inside that window and reject an aborted write.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla
node scripts/tlc.mjs apps/web/src/lib/PaperLocal.tla --mutant
pnpm --filter web exec vitest run --isolate --config vitest.config.ts src/lib/paper-local-replay.test.ts src/lib/paper-sync-journal.test.ts
node --test scripts/paper-local-durable.test.mjs scripts/paper-local-journal.test.mjs
node scripts/paper-local-crash.mjs
```

The first command uses `PaperLocal.cfg`. `JournalOnInput` and `ResolveOnCommit` are TRUE. Those are the target constants. Exit 0.

The second command uses `PaperLocal.mutant.cfg`. Both constants are FALSE. Those are the today constants. Exit 12. The runner discovers that mutant by pairing `PaperLocal.cfg` with `PaperLocal.mutant.cfg`.

Do not add `PaperLocal.today.cfg` as an ordinary config beside the model. `node scripts/tlc.mjs --all` expects every ordinary config to pass, and the today constants violate `WordsNeverLost` and `LocalSuccessMeansDurable`.

The Vitest replay blocks IndexedDB completion and recovers the synchronous journal, including words from two tabs. It checks both durability-marker orders and keeps newer input when an earlier receipt arrives. Request success followed by a transaction abort rejects `save`, and a reload does not show that record.

The crash harness uses the production sync module and IndexedDB with a fake offline server. It delivers native input events, waits for the input handler completion signal, sends SIGKILL to an isolated Chromium process group, and reopens the same profile. It runs 20 cases at each requested delay of 0, 5, 10, 20, and 40ms, plus 20 two-tab cases at 20ms. It writes actual delays, input-completion-to-kill times, survival, and input-handler times to `~/tmp/1150-crash-results.json`. Any lost token fails the command. A passing sample does not establish a universal physical durability bound for localStorage. Report losses and measured delay ranges without weakening `WordsNeverLost`.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Paper save and recovery`. The target chart is the one to approve. The today chart is the break.

Show the three TLC results in order. Clean, then the failing today constants, then clean again. Keep that evidence. A pass on the today constants means the check can no longer see a delayed journal or a save that resolves before commit.

## Bounds

One document. One tab. One typed edit. One local transaction. One reload. The network debounce, orphan adoption, and keepalive stay outside this check. Saved still requires the server receipt. The synchronous journal is cleared only after IndexedDB has committed and that receipt has arrived. IndexedDB can still be empty when the page dies, and the synchronous journal is the copy recovery reads. A crash before the browser flushes `localStorage` can still drop the latest words. That flush floor is a platform limit reported with the change, and it is not a change to the model. A second tab stays outside this check.

## When the code changes

After a change to the files named above, run `/maintain-formal-verification-skill`. Move the sync commit only after the model still matches the code and the replay keeps the typed words. Never weaken a rule to clear a finding. Do not add this model to `verify-paper-save`. `ContentStore.tla` stays the Yjs log model.

Use this skill's Git history to locate the last verification change. Keep branch-only commits out of verification anchors.
