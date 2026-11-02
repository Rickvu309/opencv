---
name: verify-read-invalidation
description: Check that every command names every read it changes in its `invalidates` list, and that an undo refreshes every read it changes, so no screen goes stale after a save. Use after any change to a command's `invalidates` in packages/domain/src/*-contract.ts, to a command handler or store write in apps/api/src, to the read list in packages/domain/src/queries.ts, to a coverage case in apps/api/src/registry/coverage-*.ts, or when asked why a screen shows old data after a save or an undo.
---

# verify-read-invalidation

## The property

For every command with a coverage case, in `apps/api/src/registry/invalidation.formal.test.ts`:

- **R1.** Every read whose answer changes when the command runs is named by that command's `invalidates(input)`. `activity.list` is free, because every command refreshes it.
- **R2.** Every read whose answer changes when the person presses Undo is named by `invalidates` of `activity.undo`. A reversal that has no activity row is checked as a plain command run, against the `invalidates` of the reversal command.

A read is named when some entry has the same query name and either no `input` or an `input` whose fields all match the read's input. That is the rule TanStack Query uses for a key prefix.

## The harm

The web refreshes only the reads a command lists (`runContractCommand` in `apps/web/src/lib/contract-client.ts`). A read left off the list keeps its old answer on screen until a reload. This shipped 4 times: saved Inbox replies, profile photos, Paper favorites and letter autosave.

## Why this tool

The question is which reads a real write changes, and only the real SQL and handlers can say. A hand model would only agree with itself. So the test drives the real `Registry` on PGlite through every coverage case (the same cases `coverage.test.ts` runs), reads every query in `queries.ts` before and after the command, and compares the two sets of answers. The expected set is never stored: it is `commands[name].invalidates(input)`, the thing under test. No TLA+, because the code is the ground truth.

## How to run

```bash
pnpm --filter api exec vitest run --config vitest.formal.config.ts src/registry/invalidation.formal.test.ts
```

About 30 seconds. `pnpm --filter api test:formal` runs it with the other formal checks, and `pnpm --filter api test` runs it too. Exit 0 means every test passed.

## Tests

| Test                                                                | Covers                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decides every read in queries.ts`                                  | `SNAPSHOT_QUERIES` is typed as one entry per query, so a new query is a type error until it gets a decision. A query left out needs a reason in `NEVER_SNAPSHOT_REASON` |
| `control: reading twice with no command in between changes nothing` | The reads are stable, so a difference after a command was caused by the command                                                                                         |
| `the snapshot reads real data, not only refusals`                   | More than 500 reads ran and under half answered with an error                                                                                                           |
| `most commands visibly change some read`                            | The check is not vacuous: over 60% of commands changed a read, and every undo changed one                                                                               |
| `R1`                                                                | Every changed read is named by the command, for each command call and each reversal run                                                                                 |
| `R2`                                                                | Every changed read is named by `activity.undo`                                                                                                                          |
| `mutant R1`                                                         | `paper.setFavorite` without `paper.list` is reported                                                                                                                    |
| `mutant R2`                                                         | `activity.undo` without `paper.list` is reported                                                                                                                        |
| pending and exemption tests                                         | A pending gap still happens, names an issue and has not expired. An exemption has a reason and names a real command                                                     |

## How a snapshot works

Before each command call the test lists the ids the user owns (jobs, papers, share tokens, files, chats, inbox threads) and builds one read per query and id. `paper.keywordGap` needs a paper and a job, so it reads only pairs where the command's input (or the undone row's subject and reversal input) names the paper or the job, plus the newest pair. Reading every pair took 70 seconds. The snapshot runs around the call to the case's own command through `run()`, so setup commands in `arrange` and `act` are not counted against it.

## How to read a counterexample

The failure reads `<scenario> changed <read> {<input>} but its invalidates() does not name it. Add { query: "<read>" } to the invalidates of <command>.`

- `<scenario>` is `job.move`, or `job.create undo` for R2, or `paper.share reversal` for a reversal with no activity row.
- Open the command's entry in `packages/domain/src/<surface>-contract.ts` and add the ref. Use `input: { <idKey>: input.<idKey> }` when only one id changes, or no input when the read can change for any id.
- If the read does not belong on the list, the handler should not write what it writes. Fix the handler, not the property.

## Exemptions and pending gaps

- `EXEMPT_COMMANDS` holds `account.delete`: the person is signed out right after, so a refetch would answer 401. An exemption needs a reason a reviewer accepts.
- `PENDING_GAPS` holds `paper.sync` (issue #916, with an expiry date): the Paper editor's autosave channel lists no reads. Whether it should refresh `paper.get`, `paper.list` and `paper.outline` is the editor's decision. The test fails when a pending gap stops happening or expires, so the entry cannot go stale. Remove it with the fix.
- Never add an entry to make a failure pass without a reviewer reading the reason.

## Bounds and assumptions

- One user, one run per command call, on PGlite. Cases run in the coverage order and share one database, so later cases see earlier rows.
- Reads use one input per id. List reads use the empty input (`job.list`, `paper.list`) and `job.calendar` uses 1970 to 2100. Filtered variants (`job.list` with a stage, `paper.list` with a kind) are prefix-matched by the same refs and are not read separately.
- Not snapshotted: `activity.list` (free), `job.preview` and `link.get` (network reads), `workspace.search` (the web never caches it).
- Only commands with a coverage case run. `coverage.test.ts` fails on a bound command with no case.
- A command whose changed answer depends on input the case does not use (for example a different letter text for `paper.keywordGap`) is not seen.
- The web's own refreshes outside `invalidates` (`refreshReads` calls) are not checked.

## Coverage record

| Item                                  | Where                                                    |
| ------------------------------------- | -------------------------------------------------------- |
| every `invalidates` entry             | `packages/domain/src/*-contract.ts`                      |
| every read                            | `packages/domain/src/queries.ts`                         |
| the refresh the web runs              | `apps/web/src/lib/contract-client.ts` (`refreshQueries`) |
| the cases that arrange, act and undo  | `apps/api/src/registry/coverage-*.ts`                    |
| the shared builder of tools and cases | `apps/api/src/registry/coverage-setup.ts`                |

Check file: `apps/api/src/registry/invalidation.formal.test.ts`. Runner: `apps/api/vitest.formal.config.ts`.

Sync commit: `692f71dc`. This is the trunk commit the check was last confirmed against. Move it forward only after you run the check at the new commit and confirm the covered files above still match the description.

## When the code changes

1. Run the command above. It is green on trunk, so a failure is a new gap or a wrong rule in the test.
2. A new command needs a coverage case whose `act` runs the command through `run()`. A new query needs an entry in `SNAPSHOT_QUERIES`.
3. Prove the check still bites. Make a scratch change, confirm a named failure, then `git checkout` the file. Useful breaks:
   - Delete `{ query: "paper.list" }` from `paper.setFavorite` in `paper-contract.ts`: R1 reports `paper.setFavorite changed paper.list`.
   - Delete `{ query: "paper.list" }` from `anyWriteChanged` in `chat-contract.ts`: R2 reports `paper.create undo changed paper.list` and four more.
   - Delete the `profile.get` ref from `inbox.skip`: R1 reports `inbox.skip changed profile.get`.
