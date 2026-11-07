---
name: verify-paper-coach-edit
description: Check a change to Paper proposals, approval, basis validation, retries, or Undo with CoachPaper and the registry replay.
---

# Verify a Coach Paper edit

Use this when a change touches a Coach proposal on a CV or letter, the approval of that proposal, the basis check, a retry of the same proposal, or Undo of that edit.

## Rules

The document is unchanged until approval. A stale basis does not approve, and the bytes stay as they were. Undo of that edit keeps later typing, or refuses and changes nothing. The same proposal commits once. An agent has no Undo action.

These are the five rules of `CoachPaper.tla`. Do not weaken a rule to clear a finding. A mutant that passes is a failure of this check.

## Where the code lives

- `apps/api/src/paper/content-coach.ts` exports `editAsCoach`, `stalePaperBasis`, and `revertCoachEdit`. `stalePaperBasis` returns `refuse` when `basedOn` is not the current revision, and `apply` when it matches. `editAsCoach` calls it only for a coach actor, and throws before any write. Switching that return from `refuse` to `apply` is the one-line change to a clean merge. The replay and the guard `paper-coach-basis` both require `refuse`.
- `apps/api/src/paper/content-store.ts` exports `coachBasisOk`, `withContent`, and `syncContent`. `coachBasisOk` still allows an older basis for a person edit. Do not use it as the coach approval rule. `syncContent` is the person write that raises the revision.
- `apps/api/src/registry/proposals.ts` exports `createProposal` and `lockProposal`. `createProposal` inserts a pending row and does not write the document. The basis read and the write stay one lock inside the approval transaction.
- `apps/api/src/registry/registry.ts` holds `execute`, `approve`, `undo`, and `tools` as methods. They are not separate exports, so the coverage map cannot name them. A coach actor whose policy is `confirm` calls `createProposal` and does not run the effect. `approve` returns the saved activity when that proposal is already approved. That return is the retry. A throw inside the effect rolls the bytes back and leaves the proposal pending. `undo` runs the reversal as the person.
- `apps/api/src/registry/coach-policy.ts` exports `coachRefusal`. `tools` and `execute` consult it. A refusal omits the command from the coach tools and rejects a coach execute with `COACH_NOT_ALLOWED`.
- `packages/domain/src/paper-contract.ts` sets the `coach` field of `paper.edit` to `confirm`. The guard `paper-coach-approval` requires that string.

`apps/api/src/paper/CoachPaper.tla.json` maps each model action to one export of `content-coach.ts`. Null means the action is implemented outside that file.

- `Propose` is null. The function is `createProposal` in `apps/api/src/registry/proposals.ts`.
- `PersonTypes` is null. The function is `syncContent` in `apps/api/src/paper/content-store.ts`.
- `Approve` is `editAsCoach`. It calls `stalePaperBasis` and then writes.
- `RetryApproval` is null. The path is the early return in `Registry.approve` when the status is already approved.
- `PersonUndo` is `revertCoachEdit`.
- `AgentTriesUndo` is null. The function is `coachRefusal` in `apps/api/src/registry/coach-policy.ts`.

## What main did

Commit `a5c61cac` still auto-executes `paper.edit` for a Coach actor, because the contract said `coach: "auto"`. It also accepts a safely mergeable stale revision, because approval called `coachBasisOk`, which treats `basedOn` at or below the current revision as safe. The strict behavior is synced only at the commit named below, and only after the replay refuses that stale basis.

## Run

From the repository root, one heavy command at a time.

```sh
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla
node scripts/tlc.mjs apps/api/src/paper/CoachPaper.tla --mutant
pnpm --filter api exec vitest run src/paper/coach-paper-replay.test.ts
```

The first command uses `CoachPaper.cfg`. Both `RequireApproval` and `BasisCheck` are TRUE. Exit 0.

The second command uses `CoachPaper.mutant.cfg`. `BasisCheck` is FALSE, so `StaleBasisRefusesWithoutWriting` fails. Exit 12. The runner discovers that mutant by pairing `CoachPaper.cfg` with `CoachPaper.mutant.cfg`.

The Vitest file replays the shortest path against `content-coach` and the registry. A coach `paper.edit` stays pending and the snapshot matches. After the person types, approval rejects with `CONFLICT` and the bytes match the snapshot from before the approval. One approval applies once. A second approval returns the same activity and writes nothing. Coach tools omit `activity.undo` and `paper.revertEdit`, and a coach execute of `activity.undo` rejects with `COACH_NOT_ALLOWED`. Person Undo either keeps later typing or rejects with `CONFLICT` and an unchanged snapshot.

Read every TLC result with `/statechart`. Copy none of its commands or install paths into this skill. The chart title is `Coach changes a Paper`.

Show the three results in order. Clean, then the failing mutant, then clean again. Keep that evidence. A pass on the mutant means the check can no longer see a skipped basis check.

## Bounds

One document. One immutable proposal. One person typing event. Revisions 0 through 3. One person Undo. One agent Undo attempt. Approval reads the basis and writes in one transaction. Byte sets stand in for document text. This check does not prove a Yjs merge, an auth session, or a durable task.

## When the code changes

After a change to the files named above, run `/maintain-formal-verification-skill`. Move the sync commit only after the model still matches the code and the replay still refuses a stale basis. Never weaken a rule to clear a finding.

Last confirmed sync commit. `3d0d2db1d352fdac82c6cf92cce615a8c2bb3a16`
