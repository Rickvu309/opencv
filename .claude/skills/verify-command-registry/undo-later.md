# P4: Undo after a later change

## The property

Act A, then act B on the same subject, then undo A: the undo is refused with `CONFLICT`, or B's effect is still there. This is a sequence, not a race.

The harm: a card moved to Applied and then to Interview jumps back to the first column when the first move is undone, and the second move is lost with no message.

Two tools check it. The harness `registry.undo-later.formal.test.ts` runs the real registry over every coverage case that has a reversal and an activity row, so it reads the real SQL. The TLA+ model `UndoLater.tla` compares the policies for the answer (Q5), because the model can show a hole (a state that comes back) that no example test finds.

## Tests

Rows in `registry.undo-later.formal.test.ts`:

| Test                                                        | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4: refuses with CONFLICT or leaves the later change intact | Runs every coverage case in order. For each one with a reversal and an activity row it runs a second command on the same subject (`LATER` table), undoes the first through `registry.undo`, then asks if the second still holds. `OWN_UNDO_GUARD` names `paper.edit`, which has its own guard. A case with no rule in `LATER` fails the test. The commands that still erase the change are listed in `KNOWN_VIOLATIONS` and must be inside `REVERSAL_EXPECT_PENDING` in `expect-pending.ts` |
| P4: job.move chain                                          | Move to Applied, then Interview. Undo of the first is `CONFLICT` with "This card moved again, so Undo was skipped" and the card stays in Interview. Undo of the second, then the first, works                                                                                                                                                                                                                                                                                               |
| P4: job.move back to the same column                        | Move to Applied, Interview, Applied again. Undo of the first is `CONFLICT` and the card stays in Applied. Undo of the third, the second, then the first works, one at a time                                                                                                                                                                                                                                                                                                                |

## Policy comparison

The model `UndoLater.tla` has one subject with two fields (stage and position) and a log of acts. An Undo appends its own live row to the log, as the code does, and the `log` policy ignores those rows. Its policies, each as a pair of configs (real passes, mutant fails). The three real configs differ: `UndoLater.cfg` is the shipped `log` policy, `UndoLater.conditional.cfg` and `UndoLater.version.cfg` check one invariant each: The model never undoes an Undo row, and the code agrees: `registry.undo` refuses a row keyed `undo:<id>` with CONFLICT (`isUndoRow` in `expectation.ts`), and the activity list does not offer Undo on it.

| Policy        | What it does                                                           | Result in the model                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allow`       | Restore always (the old `job.move`)                                    | Fails `NoLostEffect` (`UndoLater.mutant.cfg`)                                                                                                                                                                                                                                                                            |
| `conditional` | Restore each field that still equals A's result                        | Fails `NoLostEffect`: a card ends in a column it never held (`UndoLater.conditional.mutant.cfg`)                                                                                                                                                                                                                         |
| `state`       | Refuse unless the subject equals A's result (`expect`, the code today) | Alone it keeps only "Undo restores a state the card already had, never a mix of fields". `NoLostEffect` holds under `Fresh = TRUE`, an assumption the code does not keep (`UndoLater.revisit.cfg`). It fails when a later act returns to A's result, A then B then C back to A's result (`UndoLater.revisit.mutant.cfg`) |
| `version`     | Refuse unless nothing was written since A                              | Holds `NoLostEffect` but fails `ChainUndo`: after undoing B, A can no longer be undone (`UndoLater.version.mutant.cfg`)                                                                                                                                                                                                  |
| `log`         | Refuse while a later act (not an Undo row) is still live               | Holds all three with `Fresh = FALSE`, at the cost that every write makes an activity row (`UndoLater.cfg`). `job.move` uses it together with `state`                                                                                                                                                                     |

`ChainUndo` says the latest live act can always be undone. That is the reason `job.move` compares stage and position, not `updatedAt`: an undo writes `updatedAt` too, so a second Undo in a row would be refused.

## Run the model

`UndoLater.cfg` describes the undo code here; `UndoLater.mutant.cfg` is the old `allow` policy and fails `NoLostEffect`. Run `node scripts/tlc.mjs --all` (about 90 seconds for every spec). Only this one: `node scripts/tlc.mjs apps/api/src/registry/UndoLater.tla --config apps/api/src/registry/UndoLater.cfg`. Read the result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Mutants

Prove P4 still bites. Make each break in a scratch change, confirm the named result, then `git checkout` the file.

| Break                                                                                                                        | Result                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Registry.undo` skips `staleExpectation` (`?? null`)                                                                         | `P4: refuses with CONFLICT` fails with `job.move` in the erased list, and the chain test fails |
| Remove the version check in `restorePaper` (`apps/api/src/paper/store.ts`) and add `paper.attachPhoto` to `KNOWN_VIOLATIONS` | The test passes, which shows Paper erases without its check                                    |

## How to read results

- Expected output now: `registry.undo-later.formal.test.ts` shows 2 passed.
- A `P4: refuses with CONFLICT or leaves the later change intact` failure for a command not in `KNOWN_VIOLATIONS` means that command's reversal erased a later change. Give it an `expect` (see `job.move` in `apps/api/src/job/commands.ts`).
- A case with no rule in `LATER` fails the test. Add the rule for that command.
- Read the model result with the steps in Run the model.

## Adding a reversal

A new command with a reversal: give it an `expect` (see `job.move`), or the type check rejects it unless the name is in `REVERSAL_EXPECT_PENDING`. If it makes an activity row, add a rule for it in `LATER`.

## Bounds

- One later act per command, on one user, one at a time. Two later acts and the web are not driven. The model has 3 acts and 2 fields.

## Known findings

- Eleven commands still erase a later change. The bug is `job.create`, `job.update`, `job.addChecklistItem`, `job.linkPaper`, `inbox.markDone`, `inbox.snooze`, `chat.rename`, `chat.setFocus`, `paper.create`, `paper.duplicate` and `paper.import`: their reversal restores unconditionally. They are in `REVERSAL_EXPECT_PENDING` (issue 958, expiry in the file). When one gets an `expect`, remove it from that list and from `KNOWN_VIOLATIONS` in the same change.
- `job.move` refuses on both the state check and the log check (`laterLiveAction` in `expectation.ts`). A card moved A, B, then back to A's column and position is no longer undone to its first place. Not covered: the log check is not in the list pre-block, so the Undo button shows and the click is refused; and the check and the restore are separate statements, so a move that commits between them is overwritten (issue 958).
- Commands that make no activity row (`chat.rename`, `job.star`, and others in `REVERSAL_WITHOUT_ACTIVITY_PENDING` in `coverage.test.ts`) have no registry Undo, so P4 does not reach them until issue 943 gives them one.
- Paper commands in `apps/api/src/paper` wait for the editor work (issue 916) to merge before they get an `expect`.
