---
name: verify-paper-photos
description: Check that a CV photo stays while a document, an undo, a pending action, a replay, or the profile still names it, and that an unused upload older than a day is removed. Use after any change to apps/api/src/paper/photo-sweep.ts, apps/api/src/paper/photo-references.ts, the photo_refs migration, a paper or profile write that stores a file id, or when asked whether cleanup can delete a photo that is still in use.
---

# verify-paper-photos

## The property

A photo file stays for as long as something still names it, and no longer.

- **F1.** Every file id reachable from current paper content (`paper_docs.crdt_document`), from a not-undone reversal whose paper still exists, from a pending action input, from an idempotency result, from an activity result, or from the profile, still exists.
- **F2.** After Undo of a photo change, that photo still resolves.
- **F3.** An upload nothing names, older than 24 hours, is gone after one sweep.
- **F4.** A copy keeps its photo after the original document is deleted.

The sweep is one statement: delete avatar rows older than a day that have no row in `photo_refs`. A concurrent attach that inserts a reference locks the file, so the sweep waits and then keeps it. A live write that names a file which is already gone raises, the write rolls back, and the command returns not found. The migration backfill sets `opencv.photo_refs_backfill` and still skips a missing file.

## The harm

Someone's CV, a copy, Undo, or their profile picture goes blank. The same cleanup has shipped broken six times, from `2b14fc68` through `f491fe0d`.

## Why this tool

The promise is in SQL. A trigger writes `photo_refs` on every place a document can hide, and the sweep deletes in one `DELETE ... WHERE NOT EXISTS`. A hand model of that delete would only check itself, so the model test drives the real registry and the real sweep on PGlite, and on Postgres when `FORMAL_DATABASE_URL` is set. The expected set of file ids is read again from the source columns. It is not read back from `photo_refs`.

A union of those columns inside the `DELETE` is one statement and still loses to an attach that has not committed: under read committed the sweep does not see the other transaction, and an attach that only updates the paper does not lock the file row. The reference row's foreign key takes a key share lock on the file, so the delete waits. After the attach commits, the delete either skips the row or hits foreign key `23503` and retries, up to three times. That is why the table won over the union.

The attach-versus-sweep order is also a tiny TLA+ model, `PhotoSweep`. One step is one action: `Attach` and `AttachWrite` are `attachPhoto`, and `Sweep` / `SweepDrop` are `sweepUnattachedPhotos`. `Gap = TRUE` is the check, then the write, which references the file only when it is still there. Read every TLC result with `/statechart`.

## How to run

```bash
pnpm --filter api exec vitest run --config vitest.formal.config.ts src/paper/photo-lifetime.formal.test.ts src/paper/photo-lifetime.model.formal.test.ts
node scripts/tlc.mjs apps/api/src/paper/PhotoSweep.tla
node scripts/tlc.mjs apps/api/src/paper/PhotoSweep.tla --mutant
```

The vitest command is about 10 seconds. Exit 0 and `12 passed, 2 skipped` on PGlite. The skipped tests are the overlapping attach and the attach that loses its file to a sweep, which need a real server. TLC exits 0. The mutant exits 12.

`PHOTO_MODEL_RUNS` (default 8) and `FORMAL_SEED` (default 241) change the model. A deeper run is `PHOTO_MODEL_RUNS=40` on the same command.

On Postgres, set `FORMAL_DATABASE_URL` to a server you can create databases on. The test creates a database and drops it. Expect `14 passed`, including the overlapping attach and the attach that loses its file to a sweep.

## Tests

| Test                                                                                     | Covers                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| keeps a photo that only the CRDT document still names                                    | F1. The reversal and the activity receipt are cleared. The photo remains in `paper_docs.crdt_document`. The sweep does not delete the file.           |
| resolves the photo again after undo; the replacement stays while its release row remains | F2. The undo row records the dropped photo. The sweep deletes it once that row is folded.                                                             |
| sweeps an unreferenced upload older than a day and keeps a fresh one                     | F3. A sweep that returns before the delete leaves the old file.                                                                                       |
| keeps the copy's photo after the original document is deleted                            | F4                                                                                                                                                    |
| drops the copy photo when its reference row is removed                                   | F4 mutant: forgetting the copy's reference deletes the file                                                                                           |
| keeps a photo named only by a pending action until that action is closed                 | Pending input. Denied drops the reference and the sweep removes the file.                                                                             |
| keeps a photo named only by an activity result                                           | Activity result, outside the paper snapshot keys. Deleting `activity.%` references then lets the sweep remove the file.                               |
| does not keep a photo that an idempotency result only stored as previousPaper            | Idempotency keeps the current photo and drops `previousPaper`                                                                                         |
| keeps a replaced photo after Undo until its release row is removed                       | The activity ref is gone. `paper_doc_updates.released` still keeps the file. Removing that source lets the sweep delete it and keep the restored one. |
| deletes the account while a profile photo is still referenced                            | The profile reference cannot block deleting the account                                                                                               |
| an attach that commits during the sweep keeps the photo                                  | Postgres only. The sweep blocks on the key share lock, then the file remains.                                                                         |
| an attach that loses its file to a sweep does not leave a dangling id                    | Postgres only. The sweep deletes the aged file after the check and before the write. The attach returns not found and the paper does not keep the id. |
| a backfill skips a missing photo and a live write refuses it                             | The backfill flag skips a missing file. The same write without the flag raises.                                                                       |
| keeps every referenced photo across upload, edit, undo, copy, confirm and sweep          | F1 to F4 under fast-check: upload, create, attach, clear, undo, duplicate, delete, confirm, sync, age, sweep                                          |

## What the scan treats as live

- `paper_docs.crdt_document`, always.
- `paper_doc_updates.update` only while that paper's CRDT document is null. A committed CRDT document is the replay of the log. Scanning every old update would keep a photo the person already replaced.
- `paper_doc_updates.released_photo_refs` while that update row is still inside the compaction horizon. A commit that drops a header photo records the id there, and the sweep keeps the file until the row is folded.
- `activity.reversal_input` while the activity is not undone and its `docId` paper still exists. Deleting the paper drops those references. Undo of a deleted paper is not a command.
- `activity.result` while the activity is not undone, after removing `document`, `paper`, `previousDocument`, and `previousPaper`. Those keys are a receipt of the paper row. Keeping them made a photo survive after both CVs were deleted.
- `pending_actions.input` while status is `pending`.
- `idempotency.result`, after removing `previousDocument` and `previousPaper`.
- `user.image` when the whole value is a file id.

`photo-references.schema.test.ts` fails when a new jsonb column is neither in `PHOTO_DOCUMENT_COLUMNS` nor in `NOT_PHOTO_JSON`. The migration must name each scanned source. A live write raises when a photo field names a missing file. The backfill sets `opencv.photo_refs_backfill` so a historic missing file does not abort migrate.

## How to read a counterexample

- `F1 <id>`: the oracle still names that file and the row is gone. Open the trigger for the source that should have written `photo_refs`.
- `F3 <id>`: the sweep left an avatar older than a day that the oracle does not name. The `NOT EXISTS` clause or a trigger is keeping a dead reference.
- A model failure prints the fast-check seed and the command list (`upload`, `attach`, `clear`, `undo`, `duplicate`, `delete`, `confirm`, `sync`, `age`, `sweep`). Rerun with `FORMAL_SEED` set to that seed.
- TLC exit 12 on the real config is a product bug. `/statechart` shows the shortest path. With `Gap = TRUE`, Attach only checks the file, and AttachWrite references it only when the file remains. The mutant keeps `Gap = FALSE` and `Split = TRUE`. Its path is Sweep (it has not seen the attach), Attach, SweepDrop (the file disappears). Exit 0 on `--mutant` means the mutant no longer breaks `PhotoLives`.
- `sweep did not block` on the Postgres test: the delete did not wait for the open attach. The foreign key is no longer taking a key share lock.

## Mutants

| Break                                                   | What fails                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Clear the reversal and the profile                      | The CRDT-only test: the old id list would delete the file, and the real sweep must not |
| `DELETE FROM photo_refs WHERE source LIKE 'activity.%'` | The activity-result test: the sweep then returns that file                             |
| Insert a `photo_refs` row for an undone photo           | The undo test: the sweep keeps the replacement until that row is removed               |
| Sweep returns `[]` before the delete                    | The orphan stays                                                                       |
| Delete every `photo_refs` row for the copied file       | The copy mutant: the sweep returns the file                                            |
| `PhotoSweep.mutant.cfg` sets `Split = TRUE`             | `node scripts/tlc.mjs apps/api/src/paper/PhotoSweep.tla --mutant` exits 12             |

## Bounds and assumptions

- One user. A file id is counted only when it belongs to that user and the row exists, because the trigger joins `files` on id and user.
- Model size: at most 3 files and 3 documents, 6 commands per run, 8 runs unless `PHOTO_MODEL_RUNS` is set. Undo of a change that is no longer the latest is `CONFLICT` and is not a failure.
- `paper.sync` in the model is a pull (empty update, epoch 0), not a second editor.
- PGlite runs one transaction at a time, so the lock tests are skipped there. They run only on Postgres.
- `attachPhoto` checks the file and then writes the paper. The live trigger locks each named file in the same statement as the reference insert and raises when a named file is gone, so that write rolls back. The backfill flag is what lets migrate skip a missing file.
- The model does not upload a file for a second user, and it does not run the daily sweep on a clock that jumps backwards.

## Coverage record

| Item                                                     | Where                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `sweepUnattachedPhotos`                                  | `apps/api/src/paper/photo-sweep.ts`                                                                                                        |
| `referencedPhotoFileIds` and the column lists            | `apps/api/src/paper/photo-references.ts`                                                                                                   |
| `attachPhoto` (the TLA `Attach` and `AttachWrite` steps) | `apps/api/src/paper/store.ts`, re-exported from `photo-sweep.ts` for the action map                                                        |
| `isMissingPhoto`                                         | `apps/api/src/registry/errors.ts`, mapped in `transaction` in `apps/api/src/db/context.ts`                                                 |
| `photo_refs` and the triggers                            | `apps/api/drizzle/0008_photo_refs.sql`, `apps/api/drizzle/0010_paper_released_photos.sql`, `apps/api/drizzle/0011_drop_paper_document.sql` |
| jsonb column guard                                       | `apps/api/src/paper/photo-references.schema.test.ts`                                                                                       |
| F1 to F4 and the SQL mutants                             | `apps/api/src/paper/photo-lifetime.formal.test.ts`                                                                                         |
| fast-check model                                         | `apps/api/src/paper/photo-lifetime.model.formal.test.ts`                                                                                   |
| shared oracle and commands                               | `apps/api/src/paper/photo-lifetime.support.ts`                                                                                             |
| attach-versus-sweep model                                | `apps/api/src/paper/PhotoSweep.tla`, `.cfg`, `.mutant.cfg`, `.tla.json`                                                                    |

Sync commit: `81138656116d88d2813d0f73f7759ad8a71885db`. Move it only after you reread the covered functions at the new commit, rerun the three commands above, and check that every row in the coverage record still describes the code.

## When the photo code changes

1. Run the three commands above. A failure is a new bug or a wrong rule in the oracle. Do not drop a source to make F3 pass.
2. A new jsonb column needs a row in `PHOTO_DOCUMENT_COLUMNS` or `NOT_PHOTO_JSON`. A new place that stores a `file:` id needs a trigger and a line in the oracle.
3. Prove the check still bites, then put the file back. Useful breaks are the mutants table. The TLC mutant is `PhotoSweep.mutant.cfg`.
4. If you change `attachPhoto` or the sweep's `DELETE`, rerun TLC and, on a real server, the overlapping-attach test.
