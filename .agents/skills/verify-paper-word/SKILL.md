---
name: verify-paper-word
description: Check a change to how a Coach or agent Word page edit is proposed, approved, committed with its receipt, refused when stale, or undone, with WordEdit.tla and its replay.
---

# Verify a Word page edit

Use this when a change touches `paper.edit` with a revision string, its approval, the head row of a Word page, the activity receipt written with it, or `paper.undoWord`.

## Rules

The product promise: an agent or the Coach can never change a person's document without approval, and a stale edit never lands.

- `ChangesOnlyAfterApproval`. A Coach or agent batch is stored pending and moves no head until the person approves it.
- `StaleNeverLands`. Approval commits a batch only on the head it was based on. Two writers share one head.
- `BothOrNeither`. The head move and its activity receipt commit in one transaction, or neither does.
- `UndoRestoresPriorHead`. `paper.undoWord` moves the head back to exactly the revision the batch was based on, and only while the head is still the batch's revision.

These are the rules of `apps/api/src/paper/WordEdit.tla`. Do not weaken a rule to clear a finding. A mutant that passes is a failure of this check.

## Where the code lives

`apps/api/src/paper/WordEdit.tla.json` maps each model action to code. A null action names its functions under `"boundaries"`.

| Action          | Code                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Propose`       | `Registry.execute` in `apps/api/src/registry/registry.ts` sends a string `basedOn` to the reviewed branch (`select` in `apps/api/src/paper/package-edit.ts`). `prepareOrReplay` stores the candidate through `persistWordPackage` in `package-candidates.ts`. `publishFrozenReview` in `apps/api/src/registry/frozen-review.ts` calls `createProposal` for any actor that is not a person and not approving. No head row is written. |
| `PersonTypes`   | `apply` in `apps/api/src/paper/word/document.ts`: `prepareBatch`, then `compareAndRestorePackage` moves the head only from `basedOn`. The live page uses the same compare in `paper.canvas`.                                                                                                                                                                                                                                         |
| `ApproveBegin`  | `Registry.approve` locks the proposal, then `lockReviewedBasis` runs `lockBasis`, which reads the head row `FOR UPDATE` and throws `Basis conflict` unless its revision equals the candidate's `parentRevision`.                                                                                                                                                                                                                     |
| `WriteHead`     | `commitWordCandidate` in `package-candidates.ts` revalidates the sealed candidate, then `publish` moves the head with a compare on `parentRevision`.                                                                                                                                                                                                                                                                                 |
| `WriteReceipt`  | `recordCommandResult` in `apps/api/src/registry/command-execution.ts` writes the activity row inside the same `transaction` as the head move.                                                                                                                                                                                                                                                                                        |
| `Crash`         | Any throw inside that transaction rolls back both writes. The proposal stays pending.                                                                                                                                                                                                                                                                                                                                                |
| `RetryApproval` | `Registry.approve` returns the saved activity when the proposal is already approved and writes nothing.                                                                                                                                                                                                                                                                                                                              |
| `Undo`          | `Registry.undo` runs the stored reversal `paper.undoWord` as the person. `undo` in `word/document.ts` refuses with `WORD_UNDO_MOVED` unless the head is the batch's revision, then `compareAndRestorePackage` sets it back to `basedOn`.                                                                                                                                                                                             |

The basis is checked twice: `lockBasis` and the compare in `publish`. The model has one constant for each, `BasisCheck` and `CasCheck`. Removing only one still passes, because the other catches the stale batch. The mutant removes both.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs apps/api/src/paper/WordEdit.tla
node scripts/tlc.mjs apps/api/src/paper/WordEdit.tla --mutant
node scripts/tlc.mjs apps/api/src/paper/WordEdit.tla
pnpm --filter api exec vitest run src/paper/word-edit-replay.test.ts
```

`WordEdit.cfg` sets every guard TRUE and checks all four rules. Exit 0. `WordEdit.mutant.cfg` drops both basis compares, so `StaleNeverLands` fails. Exit 12. `node scripts/tlc.mjs --all` also runs the `gate`, `receipt` and `undo` pairs: each clean config exits 0, and each mutant exits 12 on `ChangesOnlyAfterApproval`, `BothOrNeither` and `UndoRestoresPriorHead`.

The replay drives the real registry on a migrated PGlite database, one test per rule. A Coach batch leaves the head and words alone until approval, lands once, and a second approval returns the same activity. An approval after the person typed throws, keeps the typed words and head, and the proposal can still be denied. A trigger that refuses the activity insert makes approval throw and leaves the head where it was; after the trigger is dropped the same proposal lands. Undo returns the exact earlier revision, and refuses with `WORD_UNDO_MOVED` after later typing.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `A Word page edit waits for approval`.

Show the three TLC results in order: clean, the failing mutant, clean again. A pass on the mutant means the check can no longer see a stale batch landing.

## Bounds and what is not covered

One Word page, one Coach or agent batch, up to two person typing commits, one approval transaction that can crash between the head write and the receipt, one Undo. Revisions are fresh numbers; content is not modelled. Proposal-time refusal of a batch read from an older revision is checked by `word-batch-proposal.test.ts`, not by this model. Not covered: two batches pending on the same page, a proposal that expires, delegate revocation (`verify-paper-coach-edit` covers the MCP reading), the content of a batch, the seal checks inside `revalidateWordCandidate`, and the person's own `paper.canvas` Undo through `restoreWordCandidate`.

## When the code changes

`"covers"` and `"sync"` in `WordEdit.tla.json` record the covered files and the commit where the model last matched them. `node scripts/tlc.mjs --stale` lists commits that touched those files since. After such a change, run `/maintain-formal-verification-skill`, and move `"sync"` only after the model still describes the code at the new commit on `main`. Never weaken a rule to clear a finding.
