---
name: verify-paper-lease
description: Check a change to who may edit a Paper with PaperLease and the hash replay.
---

# Verify who may edit

Use this when a change touches who may move the stored head, a stale parent, or a second live lease.

## Rules

Only the lease holder moves the head. A stale parent hash does not move it, and the loser's bytes are kept. Two live leases do not exist.

These are the rules of `PaperLease.tla`. Do not weaken a rule to clear a finding. A run that passes on the fence fault is a failure of this check.

## Where the code lives

`packages/domain/src/paper-save.ts` grants one live lease. `grant` throws while that lease is held, unless the exclusive fault is on. `save` refuses a stale lease and a stale parent, keeps the head, and retains the losing bytes. The fence fault lets a stale lease move the head. The parent fault lets a stale parent move the head.

The module is not the live save path. It has no Yjs types and no UI. `ContentStore.tla` stays the model of today's Yjs log. This check does not claim that log implements this protocol. Save receipt faults stay in `verify-paper-save`.

`packages/domain/src/PaperLease.tla.json` maps `Grant` to `grant` and `Save` to `save`. `Expire` is model-only.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs packages/domain/src/PaperLease.tla
node scripts/tlc.mjs packages/domain/src/PaperLease.tla --mutant
pnpm --filter @workspace/domain exec node --experimental-strip-types --import ./register-ts.mjs --test src/paper-save.test.ts
node --test scripts/paper-save.test.mjs
```

The first command uses `PaperLease.cfg`. Fault is none. Exit 0.

The second command uses `PaperLease.mutant.cfg`. Fault is fence. Exit 12. The runner discovers that mutant by pairing `PaperLease.cfg` with `PaperLease.mutant.cfg`.

Do not add `PaperLease.exclusive.cfg`, `PaperLease.fence.cfg`, or `PaperLease.parent.cfg` as ordinary configs beside the model. Each of those copies sets Fault to none, and `node scripts/tlc.mjs --all` expects every ordinary config to pass. The replay covers exclusive, fence, and parent.

The domain test drives `paper-save.ts`. A second grant while a lease is held throws. A stale parent and a stale lease keep the head and the losing bytes. An expired lease is refused at its expiry boundary and afterward, before another writer takes over. The head, packages, commit count, and receipts stay unchanged.

The source-mutation check removes the actual expiry comparison from `save` in a scratch copy. The unchanged replay must fail on that copy and pass again after restoration. It also checks the always-true Saved mutation. Export-name maps and independent model faults do not replace this check.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Who may edit`.

Show the three TLC results in order. Clean, then the fence fault, then clean again. Keep that evidence. A pass on the fence fault means the check can no longer see a writer who does not hold the lease.

## Bounds

Writers are Tab A, Tab B, and Coach. Head and epoch stay at most 2. One document. The live editor, IndexedDB, and the server receipt path are outside this check.

## When the code changes

After a change to `packages/domain/src/paper-save.ts`, run `/maintain-formal-verification-skill`. Update this skill only after the model still matches the code and the replay keeps one live lease. Never weaken a rule to clear a finding.

Use this skill's Git history to locate the last verification change. Keep branch-only commits out of verification anchors.
