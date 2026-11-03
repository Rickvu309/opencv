---
name: verify-paper-sync
description: Check the paper cache and version protocol in apps/api/src/paper, that the cached page matches the saved log after every committed step, the version equals the highest change number with no gaps, a typed character survives an interleaved Coach edit and a stale full replace, and a Coach edit on another block still lands when the read is behind only because the person typed elsewhere. Use after any change to content-store.ts, the replace path in store.ts, editAsCoach or checkedBasis in content-coach.ts, or when asked whether a Coach edit can drop a letter the person just typed.
---

# verify-paper-sync

The plan name `content-store.tla` is this file: `apps/api/src/paper/ContentStore.tla`. A TLA module name cannot contain a hyphen.

## The property

For one paper, the in-process cache, and two writers, in `apps/api/src/paper/content-store.ts`:

- **P1.** After every committed step, and again when the lock is quiet, the cached page equals the log materialized. A cache left ahead by a commit the database rolled back is rebuilt, not trusted.
- **P2.** `contentVersion` equals the highest change number, and the change numbers have no gaps.
- **P3.** A character a person synced survives a Coach edit on another block, and survives a full replace sent at an older version.
- **P4.** A Coach edit of a block the person did not touch still lands when the read is behind only because the person typed on a different block.

## The harm

A letter you type disappears when Coach edits another part of the same page, or the saved page and the list of changes stop matching.

## Why this tool

The bugs are orderings: a commit that rolls back after the cache moved, a second commit inside one lock, a full replace of an older read, and a Coach edit from a read the person's typing has passed. TLC checks every order of those steps at a small bound (2 writers, 2 blocks, version at most 3). A fast-check test then drives the real store and real Yjs, on PGlite and on Postgres, because only the real code writes the real log.

## How to run

```bash
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --config apps/api/src/paper/ContentStore.seq.cfg
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --config apps/api/src/paper/ContentStore.version.cfg
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --mutant
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --config apps/api/src/paper/ContentStore.seq.mutant.cfg
node scripts/tlc.mjs apps/api/src/paper/ContentStore.tla --config apps/api/src/paper/ContentStore.version.mutant.cfg
pnpm --filter api exec vitest run src/paper/content-sync.formal.test.ts
```

- Real configs exit 0. Each mutant exits 12. `node scripts/tlc.mjs --all` includes this spec (the `formal-tla` job). `ContentStore.cfg` is 2227 distinct states.
- `pnpm --filter api test:formal` runs this file with the other formal tests. With `FORMAL_DATABASE_URL` set, the same file runs on Postgres (the `formal-postgres` job). Without it, PGlite.
- Read the result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Model to code

`ContentStore.tla.json` maps every action of `Next` to an export of `content-store.ts`. `syncContent`, `coachBasisOk` and `sameContentVersion` are called from the sync command, `content-coach.ts` and `store.ts`.

| Action            | Code                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Lock`            | `cacheRevisionUsable` in `caughtUp`: an ahead cache is dropped and the page is rebuilt from the log                     |
| `Person`          | `syncContent`: a push names `basedOn` and is absorbed only when that equals the saved revision                          |
| `Commit`          | `nextContentSeq`: the next change number is the cached revision plus one                                                |
| `Coach`           | `coachBasisOk` in `checkedBasis`: a Coach edit is allowed when `basedOn` is between the log base and the saved revision |
| `Replace`         | `sameContentVersion` in `replacePaper`: a full replace whose version is not the saved one conflicts                     |
| `Rollback`, `End` | `withContent`: a throw after a successful edit deletes the cache; ending the lock does not                              |
| `Evict`           | `withContent`: the cache is an in-process map with a size limit                                                         |

Constants are the code's switches. `RevisionGuard` is the refusal to trust a cache whose revision is past the saved version. `SeqFromEntry` numbers the next change from the running cached revision, not from the row version captured when the lock was taken. `VersionCheck` is the version compare before a full replace. Each mutant flips one of them.

## Checks and mutants

| Config pair                | Checks         | Mutant (must fail)                                                                                                                         |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ContentStore.cfg`         | P1, P2, P3, P4 | `RevisionGuard` off: after a rolled-back commit, the next lock trusts the ahead cache. P1 fails (exit 12)                                  |
| `ContentStore.seq.cfg`     | P2             | `SeqFromEntry` off: the second commit in one lock reuses the row version from lock time, so two changes get one number. P2 fails (exit 12) |
| `ContentStore.version.cfg` | P3, P4         | `VersionCheck` off: a full replace of an older page wipes the typed character. P3 fails (exit 12)                                          |

Deleting only the early `cacheRevisionUsable` compare in `caughtUp` does not fail P1. The replay still ends with `revision !== contentVersion` and rebuilds. The mutant turns off the whole decision to trust an ahead cache. Leave the early compare; it is the same decision, written where the cache is first considered.

`commit` calls `nextContentSeq(entry.revision)`. A caller that keeps the row `withContent` returns, and edits again, still agrees with numbering from that row, because the returned row has the new version. The model freezes the row at lock time, which is the broken formula `row.contentVersion + 1` on the second write. The property test checks that `nextContentSeq(snapshot + 1)` is not in the set of numbers `nextContentSeq(snapshot)` already took.

## Tests

`content-sync.formal.test.ts` drives `paper.sync`, `paper.edit` and `paper.replace` with real Yjs.

| Test                                                       | Covers                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| formula checks                                             | `cacheRevisionUsable`, `nextContentSeq`, `sameContentVersion`, `coachBasisOk`, and the snapshot formula colliding |
| a rolled-back edit                                         | the cache is dropped; the next sync still sees the page from before the edit (P1)                                 |
| two edits in one lock                                      | the change numbers are consecutive (P2)                                                                           |
| Coach edits the other block from an older read             | the edit lands, the typed character stays, and a replace at version 1 conflicts (P3, P4)                          |
| replace at the live version with the old page              | the typed character is gone, so the version check is what saves it                                                |
| fast-check of coach edits, more typing, and stale replaces | every typed character is still in the saved page (P3)                                                             |

A pull sends no `basedOn`. A push sends the revision the client just read. A second `setText` of a block a newer Coach edit already touched, from the same older read, is refused. That refusal is not P4. P4 is the first edit of a block the person did not touch.

## How to read a counterexample

`Lock` of a cache with `cacheAhead` and `cacheR` above `version` is a rolled-back commit being trusted: P1. `Commit` with `gap` true is two changes given one number: P2. `Replace` with `lost` true is the old page written over the typed character: P3. Draw the trace with /statechart.

P4 in the model is `~blocked`. `Coach` is enabled when some block has a person's mark and another does not, and it never sets `blocked`. That only shows the step stays enabled. The store test is what shows the edit lands. Do not add a temporal property for it.

## Known gaps

- The Coach write people use is `paper.edit` (`editAsCoach`), which merges and allows an older `basedOn` inside the log. `paper.replace` still conflicts unless the version matches. A replace at the current version with the old page does wipe the character.
- `replacePaper` compares the version in code while it holds the row lock, then writes. The lock makes that check race-safe inside the transaction. An older change moved the same check into the write's `WHERE`. This model does not require that shape.
- `packages/domain/src/paper-doc/rebase.ts` is not on this path. `paper.edit` merges through Yjs and `personWorkLost`, not through `rebasePending`.
- Bound is 2 writers, 2 blocks, and version at most 3. The cache is one process. A second process does not share it.
- P4's model invariant does not prove the write. The store test does, for one Coach edit of the other block from the version before the person typed.

## Coverage and sync

- Covered: `apps/api/src/paper/content-store.ts` (`caughtUp`, `commit`, `syncContent`, `withContent`, `cacheRevisionUsable`, `nextContentSeq`), `apps/api/src/paper/store.ts` (`replacePaper` via `sameContentVersion`), `apps/api/src/paper/content-coach.ts` (`checkedBasis` via `coachBasisOk`, `editAsCoach`).
- Last confirmed against: this change (#1060). The squash sha replaces it after merge.
- When a covered file changes, rerun the commands above. Move the sync commit forward only after you confirm the model still describes the code at the new commit. Update `ContentStore.tla.json` when an action's function is renamed.
