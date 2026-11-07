---
name: verify-paper-save
description: Check a change to a saved Paper hash, a lost reply, or a crash before commit with PaperSave and the hash replay.
---

# Verify a Paper save

Use this when a change touches the pure save module, the stored hash, a retry after a lost reply, or a crash before commit.

## Rules

Saved names the hash that was stored. A lost reply then a retry stores one head. An older hash never replaces a newer head. A crash before commit leaves the previous head.

These are the rules of `PaperSave.tla`. Do not weaken a rule to clear a finding. A run that passes on the retry fault is a failure of this check.

## Where the code lives

`packages/domain/src/paper-save.ts` speaks in hashes. `save` stores one head for a request id. A second call with the same id returns the stored receipt and does not commit again, unless the retry fault is on. A stale parent keeps the previous head and retains the losing bytes. A crash throws before the head moves, unless the crash fault is on. `canShowSaved` is true only when the head, the package, and the stored receipt are that same hash.

The module is not the live save path. It has no Yjs types and no UI. `ContentStore.tla` stays the model of today's Yjs log. This check does not claim that log implements this protocol.

`packages/domain/src/PaperSave.tla.json` maps `Send`, `AcceptDurably`, `Retry`, `ServerFails`, and `DelayedOldSave` to `save`. It maps `DeliverReceipt` to `canShowSaved`. `Type`, `LoseReply`, `GoOffline`, `Reconnect`, and `Reload` are model-only.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs packages/domain/src/PaperSave.tla
node scripts/tlc.mjs packages/domain/src/PaperSave.tla --mutant
pnpm --filter @workspace/domain exec node --experimental-strip-types --import ./register-ts.mjs --test src/paper-save.test.ts
```

The first command uses `PaperSave.cfg`. Fault is none. Exit 0.

The second command uses `PaperSave.mutant.cfg`. Fault is retry. Exit 12. The runner discovers that mutant by pairing `PaperSave.cfg` with `PaperSave.mutant.cfg`.

Do not add `PaperSave.crash.cfg`, `PaperSave.journal.cfg`, `PaperSave.parent.cfg`, `PaperSave.receipt.cfg`, or `PaperSave.retry.cfg` as ordinary configs beside the model. Each of those copies sets Fault to none, and `node scripts/tlc.mjs --all` expects every ordinary config to pass. The replay covers receipt, retry, parent, and crash. Lease faults stay in `verify-paper-lease`.

The domain test drives `paper-save.ts`. A lost reply retried once keeps one head. A crash leaves the old head. Each broken fault throws.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Saving a Paper`.

Show the three TLC results in order. Clean, then the retry fault, then clean again. Keep that evidence. A pass on the retry fault means the check can no longer see a second stored head.

## Bounds

Hashes from 0 to 2. At most two commits of one hash in the model, and one commit in the module. One document. One request id. Offline, reload, and a lost reply are in the model. The live editor, IndexedDB, and the server receipt path are outside this check.

## When the code changes

After a change to `packages/domain/src/paper-save.ts`, run `/maintain-formal-verification-skill`. Move the sync commit only after the model still matches the code and the replay keeps one stored head. Never weaken a rule to clear a finding.

Last confirmed sync commit. `unconfirmed`
