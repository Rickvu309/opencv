---
name: verify-coach-turn
description: Check the Coach turn lifecycle in apps/api/src/coach, that one turn runs per chat, every edit the Coach commits has a receipt in a saved reply even after Stop, a provider failure, a failed save or a crash, every admitted turn ends or its lease expires, and a regenerate leaves one visible reply. Use after any change to apps/api/src/coach/turn.ts, turn-steps.ts, usage-store.ts, http.ts, sse.ts, to insertCoachMessage or trackChatTurn in apps/api/src/chat, to the coach_usage table, or when asked whether Stop, a crash or a second tab can leave an edit with no trace in the chat or the chat locked.
---

# verify-coach-turn

## The property

For one chat and two browser tabs, in `apps/api/src/coach/turn.ts`:

- **C1.** At most one Coach turn is running per chat.
- **C2.** Every activity row the Coach commits in a turn is a tool part in that turn's saved reply, and stays listed in Undo. If the process dies or the save fails, a turn admitted later in that chat saves the orphan's reply first (`OrphanSaved`).
- **C3.** Every admitted turn reaches a `finishReason`, or its lease expires. A turn that does not crash always reaches it, even when saving the reply fails.
- **C4.** A regenerate leaves exactly one visible Coach reply after the last person message.

## The harm

The Coach changes a CV or a job and the chat shows no record of it, or the chat refuses new messages, or two replies appear for one question.

## Why this tool

The bugs are orderings among Stop, a tool that has already started, a provider failure, a crash, the 5 minute lease and a second tab. A TLC model in TLA+ checks every order at a small bound (2 tabs, 2 tools). A vitest test then drives the real `runCoachTurn` with a fake runtime whose tool commits after Stop, because only the real code reads the real SQL.

## How to run

```bash
node scripts/tlc.mjs --all
pnpm --filter api test:formal
```

- `tlc.mjs --all` runs every config in `apps/api/src/coach` and expects each real config to pass (exit 0) and each `.mutant.cfg` to fail with exit 12 (invariant), or with the exit the `mutants` entry of `CoachTurn.tla.json` declares (`release` is 13, liveness). About 3 minutes on a loaded box; `CoachTurn.cfg` is most of it (300k states).
- A single config: `node scripts/tlc.mjs apps/api/src/coach/CoachTurn.tla --config apps/api/src/coach/CoachTurn.lock.cfg`.
- `pnpm --filter api test:formal` runs `turn.abort.formal.test.ts` with the other formal tests. `pnpm --filter api exec vitest run src/coach/turn.abort.formal.test.ts` runs that file alone.
- Read the result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Model to code

`CoachTurn.tla.json` maps every action of `Next` to an export of `turn-steps.ts`, which `turn.ts` calls. Steps with no code of their own (`atRest`, `maybeTitle`, `crash`, `leaseExpire`, `disconnect`, `modelFinish`, `providerFail`, `abortEnd`, `insertFails`) name the function whose behavior they change.

| Action                                         | Code                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startTurn`                                    | `openCoachUsage` (usage-store.ts): user row lock, active lease check, lease row insert                                                                                                                                                                |
| `toolExecute`, `registryCommit`                | `createTurnEffects().execute` around `registry.execute`; the abort check before it in `liveParts`                                                                                                                                                     |
| `recordPart`                                   | `appendCoachPart` on the loop's tool-result, and `recordMissingReceipts` at finalize: reads `activity` and `pending_actions` by `turn_id` (`Registry.turnReceipts`), not from memory                                                                  |
| `disconnect`, `stopTurn`, `abortEnd`           | `stream.onAbort` and `trackChatTurn` abort the signal; the loop in `runCoachTurn` ends                                                                                                                                                                |
| `modelFinish`, `providerFail`                  | the `finish` and `error` parts in the loop                                                                                                                                                                                                            |
| settle (the `settled` guard)                   | `settleTools()` in the `finally` block, before the reply is saved                                                                                                                                                                                     |
| `insertCoachMessageRead`, `insertCoachMessage` | `insertCoachMessage` (chat/store.ts): chat row lock, chain walk, stale check, then insert                                                                                                                                                             |
| `finishCoachUsage`                             | `finishCoachUsage`, now in a `finally` around the insert                                                                                                                                                                                              |
| `crash`, `leaseExpire`                         | process death; the `gt(createdAt, now - 5 min)` filter in `openCoachUsage`                                                                                                                                                                            |
| `startTurn` (admitted branch, with `Recovery`) | `saveRepliesForUnsavedTurns` (usage-store.ts), called inside the admission transaction of `openCoachUsage`: a turn with no `message_id` and receipts by `turn_id` gets an `error` reply. Recovery is not a step of its own; no admission, no recovery |

Constants are the code's switches: `Settle`, `RecordOnAbort`, `Reconcile`, `Recovery`, `FinishInFinally`, `LeaseFilter`, `SkipToolPart`, `ReleaseNeedsSaved`, `SupersedeLock`, `LongTurns`, `CrashesOn`. Each `.mutant.cfg` flips exactly the constants named below.

## Checks and mutants

| Config pair               | Checks                                                      | Mutant (must fail)                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CoachTurn.cfg`           | C1, C2, C3, Undo listing, C4, `OrphanSaved`, under crash    | `Settle`, `RecordOnAbort`, `Reconcile` and `Recovery` off: the code before #928. C2 fails (exit 12)                                                         |
| `CoachTurn.crash.cfg`     | `OrphanSaved` and C2, reconcile by `turn_id` plus recovery  | `Recovery` off: delete the `saveRepliesForUnsavedTurns` call in `openCoachUsage`. A turn admitted after a crash finds no receipt for the dead one (exit 12) |
| `CoachTurn.part.cfg`      | C2 with the tool part recorded (`Reconcile` off, loop only) | `SkipToolPart`: skip `appendCoachPart` for `tool-result`. C2 fails                                                                                          |
| `CoachTurn.admission.cfg` | C1                                                          | `LeaseFilter` off: delete the whole `if (active) throw` check in `openCoachUsage` (usage-store.ts). C1 fails                                                |
| `CoachTurn.release.cfg`   | C3 (non-crashed turn finishes)                              | `ReleaseNeedsSaved`: `finishCoachUsage` only when saved. C3 fails (exit 13)                                                                                 |
| `CoachTurn.lock.cfg`      | C4 with `LongTurns` (overlap possible)                      | `SupersedeLock` off: drop the chat row lock in `insertCoachMessage`. C4 fails                                                                               |

The part, admission, release and lock pairs hold `Reconcile` and `Recovery` as they were before this fix, to test their own switch alone.

## Tests

`turn.abort.formal.test.ts`, driving `runCoachTurn` on PGlite with a fake runtime whose `job.create` tool commits after `stream.abort()`:

| Test                                   | Covers                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| control, nobody stops the turn         | the activity row and the reply's tool part carry the same id               |
| Stop during an edit                    | the reply is `aborted` and holds the receipt of the committed edit         |
| Stop during an edit, Undo              | the activity row has its reversal and is not undone                        |
| provider failure while an edit commits | the reply is `error` and holds the receipt                                 |
| the reply cannot be saved              | `coach_usage.finishReason` is set, so the chat is not locked for 5 minutes |

`turn.recovery.formal.test.ts`, same harness, with the save failure and the dead turn:

| Test                           | Covers                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| stamps the edit with the turn  | the Coach's `activity.turn_id` is its `coach_usage.id`; a person's rows have none          |
| a reply that cannot be saved   | the next `openCoachUsage` saves an `error` reply with the receipt; the edit stays undoable |
| a turn that died after an edit | the lease blocks the next turn until it expires, then the receipt is saved                 |
| recovers once                  | later admissions do not save a second reply                                                |

## The assumption behind C1

`LeaseFilter` plus a lease of 5 minutes only keeps one turn running if a turn ends within 5 minutes. `streamText` has a `totalMs` of 120 seconds. A `registry.execute` has no timeout. With `LongTurns` on, a second turn is admitted while the first still runs, so C1 fails by design; `CoachTurn.lock.cfg` turns it on only to show the chat row lock still keeps C4. Do not add `INVARIANT C1` to a config with `LongTurns` on.

## How to read a counterexample

The trace names the code's step: `registryCommit` after `abortEnd` and `insertCoachMessage` is a tool commit after the reply was saved. Draw it with /statechart. A violated `C2` with `Settle` on means a path saves the reply before a started tool settles. A violated liveness property names the turn that stays admitted forever.

## Known gaps

- Recovery runs at the next admission to that chat. Until the person sends again, the chat shows no receipt for a turn that died; the edit is listed in Undo (`activity.list`).
- A turn that runs past the 5 minute lease while still alive can get a second, recovered reply if its own save then succeeds. `LongTurns` is not covered by a fix, only by the chat row lock for C4.
- A Coach `confirm` proposal carries `turn_id` on `pending_actions`; the activity row written when the person approves it has none, because the approval is not part of the turn.
- The database does not require a `turn_id` on a Coach activity row, because an approved proposal runs as the Coach without a turn.

## Coverage and sync

- Covered: `apps/api/src/coach/turn.ts`, `turn-steps.ts`, `usage-store.ts`, `http.ts` (`startTurn`), `receipt.ts` (`withMissingReceipts`), `apps/api/src/chat/store.ts` (`insertCoachMessage`), `apps/api/src/registry/turn-receipts.ts` (`readTurnReceipts`) and `registry.ts` (the `turn_id` stamps at the activity and pending-action inserts).
- Last confirmed against: `692f71dc` (the merged #928) plus this change (#931); the squash sha replaces it after merge.
- When a covered file changes, rerun both commands. Move the sync commit forward only after you confirm the model still describes the code at the new commit. Update `CoachTurn.tla.json` when an action's function is renamed.
