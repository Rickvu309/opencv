---
name: verify-delivery
description: Check the delivery tool's issue claim and merge queue wait, that two takes never both win a live claim outside the residual window, a claim stamped in the future never keeps the lease, merge --wait reports MERGED only at the head the agent queued and never for a pull request that left the queue, an infra rerun queues again at most once, and the wait always ends. Use after any change to scripts/ocv-tools/take.mjs, claim.mjs, claim-marker.mjs, work.mjs (save), jobs/merge.mjs or jobs/infra-rerun.mjs, or when asked whether two agents can both hold one issue or merge --wait can report the wrong merge.
---

# verify-delivery

## The property

For the issue claim (`scripts/ocv-tools/take.mjs`, `claim.mjs`, `claim-marker.mjs`):

- **D1.** Two takes never both succeed with live claims, outside the residual window. When both succeed, the later claim comment was posted after the earlier take had returned. The earlier agent's next `save` is then LOST (`work.test.mjs`, "the residual race"). A take that returns success is the live holder at that moment (`WinnerHoldsAtReturn`).
- **D4.** A claim stamped in the future never keeps the lease. Only GitHub's own comment stamp (`updatedAt`) counts, never the `at=` text in the marker, and a stamp ahead of the server clock by more than `CLAIM_SKEW_MS` counts as idle.

For the queue wait (`scripts/ocv-tools/jobs/merge.mjs`):

- **D2.** `MERGED` is reported only when the merged head is the head the agent queued.
- **D3.** `waitForMerge` always ends.
- **D5.** A pull request that left the queue is never reported merged, and an infra rerun queues the pull request again at most once.

## The harm

Two agents build the same issue and one loses its work, or an agent reports its pull request merged and closes the issue when someone else's push is what merged, or `merge --wait` runs forever in the background.

## Why this tool

The bugs are orderings between an agent's reads and writes and what GitHub does in between: other comments, a forged or human marker, a queue removal, a foreign push, CI restarting. TLC checks every order at a small bound. GitHub is modeled as an adversary that may act between any two steps. A trace test then feeds every state TLC reaches to the real pure functions (`holderOf`, `leaseAt`, `classify`), which must agree with the model step by step. That ties the model to the code without a network.

## How to run

```bash
node scripts/tlc.mjs --all
node --test scripts/ocv-tools/delivery-trace.test.mjs
```

- `tlc.mjs --all` runs every config in the repo. Each real config must pass (exit 0). Each `.mutant.cfg` must fail with exit 12, or with the exit the `mutants` entry of its `.tla.json` declares (`MergeWait.limit` is 13, liveness). The delivery configs take about 90 seconds; `TakeClaim.cfg` is most of it (2.1M states).
- One config: `node scripts/tlc.mjs scripts/ocv-tools/jobs/MergeWait.tla --config scripts/ocv-tools/jobs/MergeWait.limit.cfg`.
- The trace test runs TLC with `--dump` on small bounds (about 20 seconds). Without Java it prints `SKIP delivery traces` and skips; CI has no Java, so run it by hand.
- Read the result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Model to code

`TakeClaim.tla.json` maps every action to an export of `claim.mjs`. `MergeWait.tla.json` maps to `merge.mjs`. Environment steps name the function whose input they change.

| Action                                    | Code                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `TakeRead`                                | `takeInner` first `readClaim`, then the HELD rule in `decideTake`                                            |
| `TakeRaced`                               | the fresh `readClaim` after `createWorktree`, then `decide("take-raced")`                                    |
| `PostClaim`                               | `ctx.ports.gh.comment(n, claimBody(...))` in `takeInner`                                                     |
| `ConfirmRead`                             | the fresh `readClaim` after the comment; anything but live and mine is `lostTake`                            |
| `Save`                                    | `save` in `work.mjs`: `readClaim`, LOST unless I hold it (live or idle), then `heartbeat` edits that comment |
| `Tick`, `ForeignClaim`, `ForeignRelease`  | the server clock; any comment that carries a claim or release marker, with any `at=` and a stamp up to ahead |
| `Enqueue`                                 | `enqueue` (`gh pr merge --squash --match-head-commit`) in `merge`                                            |
| `ViewAfterEnqueue`                        | the `pr view` right after it; MERGED counts only at the queued head (`mergedAtHead`)                         |
| `WaitProcessStarts`                       | only in `MergeWaitHandoff.cfg`: a second `merge --wait` process that reads the head again                    |
| `Poll`                                    | one turn of `waitForMerge`: `queueSnapshot`, `classify`, the hold, `requeueAfterRerun`, `settleInfra`        |
| `QueueMerges`, `QueueRemoves`, `PrClosed` | the queue merges, drops (`failed_checks`, other, or with no removal event yet) or someone closes             |
| `ForeignPush`, `ForeignEnqueue`           | someone pushes a new head (GitHub drops the queue entry), or queues the current head                         |
| `CiRestarts`, `CiFinishes`                | CI on the head reruns and ends green, red, or red with no step run (`infra`)                                 |

Constants are the code's switches: `Confirm` (the post-comment read), `TrustAt` (lease from `at=`), `HeadCheck` (the `HEAD_MOVED` branch), `Limit` (`WAIT_LIMIT_SECONDS`), `RequeueOnce` (`state.requeued`), `Handoff` (the two-process flow). One model hour is one tick: `Idle = 3` is `CLAIM_IDLE_MINUTES`, and `Skew = 0` because `CLAIM_SKEW_MS` is under an hour. `LimitSteps` stands for 45 minutes of polls.

## Checks and mutants

| Config pair             | Checks                                                                 | Mutant (must fail)                                                                                      |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `TakeClaim.cfg`         | D1 (`TwoTakesNeverBothLive`, `WinnerHoldsAtReturn`) and D4, two takers | `Confirm` off: drop the post-comment `readClaim`. Two takers post, both return success (exit 12)        |
| `TakeClaim.lease.cfg`   | D4 (`FutureStampNeverHolds`), one taker, claims age past 180 minutes   | `TrustAt` on: `leaseAt` reads `at=` with no skew check. A forged `at=` keeps the claim live (exit 12)   |
| `MergeWait.cfg`         | D2 (`MergedOnlyAtEnqueuedHead`), D5 (`LeftQueueNeverMerged`)           | `HeadCheck` off: remove the `HEAD_MOVED` branch. A foreign head merges and is reported MERGED (exit 12) |
| `MergeWait.limit.cfg`   | D3 (`WaitEnds`, liveness under fair polling)                           | `Limit` off: remove `WAIT_LIMIT_SECONDS`. The wait polls a queued pull request forever (exit 13)        |
| `MergeWait.requeue.cfg` | D5 (`RequeueAtMostOnce`)                                               | `RequeueOnce` off: drop the `state.requeued` guard. A second silent drop queues again (exit 12)         |

`MergeWaitHandoff.cfg` is not a pair. It models the documented flow, `merge <n>` and then a new `merge <n> --wait` process, and fails D2 (exit 12) until issue #1015 is fixed. Run it by name; `--all` skips it.

## Trace test

`scripts/ocv-tools/delivery-trace.test.mjs`:

| Test                                   | Covers                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| value reader                           | the TLA value and dump parser                                                                                                        |
| two takers                             | `holderOf` and `leaseAt` match `seen` at every `TakeRead`, `TakeRaced` and `ConfirmRead` state                                       |
| claims age, stamps run ahead           | the same with one taker over 4 hours; reads reach none, released, live and idle                                                      |
| lease trusts `at=`                     | the `TrustAt` model disagrees with `leaseAt`, so the test can fail                                                                   |
| queue snapshots                        | `classify` matches `verdict` on every snapshot; snapshots reach none, MERGED, HEAD_MOVED, LEFT_QUEUE, CI_FAILED                      |
| no `HEAD_MOVED` branch                 | the `HeadCheck` off model disagrees with `classify`                                                                                  |
| merged at a foreign head after enqueue | `merge` on the job fixture: the `pr view` right after enqueue shows MERGED at another head, and nothing is reported merged or closed |

Model time maps to ISO stamps one hour per tick; `waited` maps to seconds by `LimitSteps`.

## How to read a counterexample

The trace names the code's step. `PostClaim` by both takers, then `ConfirmRead` returning `won` for the first, is the race the post-comment read exists to catch. `ForeignPush`, `CiFinishes`, `ForeignEnqueue`, `QueueMerges` then `Poll` with `reported = "MERGED"` is a foreign head reported as yours. Draw it with /statechart. A failing trace test names the action, the model's view and the code's view; that is drift between the model and the code, so fix whichever is wrong and say which in the PR.

## Known gaps

- `save` is one step here. The post-push window (a claim posted after save's last read) is the residual race that `work.test.mjs` pins.
- Comments are trusted. Anyone who can comment can post a marker, so a forged release or claim frees or takes an issue (`ForeignRelease`, `ForeignClaim`). D1 still holds for the two takers.
- Billing (`BILLING_BLOCKED`) and merge conflicts end the wait like any other refusal and are not separate states.
- Bounds: two takers, at most 3 comments, 3 hours; one foreign push, 3 to 5 GitHub steps per run.

## Coverage and sync

- Covered: `scripts/ocv-tools/take.mjs` (`takeInner`, `lostTake`), `claim.mjs` (`readClaim`, `heartbeat`), `claim-marker.mjs` (`holderOf`, `leaseAt`), `work.mjs` (`save`), `jobs/merge.mjs` (`classify`, `waitForMerge`, `requeueAfterRerun`, `settleInfra`, `merge`), `jobs/infra-rerun.mjs` (`steplessRun`).
- Last confirmed against: `9ecbcc7c` plus this change (#1008); the squash sha replaces it after merge.
- When a covered file changes, rerun both commands. Move the sync commit forward only after you confirm the model still describes the code at the new commit. Update the `.tla.json` maps when a function is renamed.
