---
name: verify-command-registry
description: Check the command registry's promise under concurrent calls, that a keyed command runs once and replays, a pending action runs at most once, an activity row is undone at most once, and an Undo never erases a change made after it. Use after any change to apps/api/src/registry/registry.ts, to execute, approve, deny or undo on the registry, to the activity or idempotency or pending_actions tables in apps/api/src/db/schema.ts, to transaction in apps/api/src/db/context.ts, or to a reversal in apps/api/src/*/commands.ts, or when asked whether a double click or a retry can duplicate a job, CV or message, or whether Undo can wipe a later edit.
---

# verify-command-registry

## The property

However concurrent calls interleave, in `apps/api/src/registry/registry.ts`:

- **P1.** A command called with an idempotency key runs its effect once, and every caller gets the same replayed result with no raw database error.
- **P2.** A pending action is executed at most once however many `approve` calls race, and `approve` and `deny` never both win.
- **P3.** An activity row is undone at most once however many `undo` calls race, and `undo` of a row with no reversal is refused.

## The harm

For P1 to P3:

A double click or a retry duplicates a job, CV or message, or runs a reversal twice. A caller who loses a race sees a database error instead of the answer the winner got.

## Why this tool

The question is whether calls that overlap can break a promise, and the promise lives in SQL (a unique index, `FOR UPDATE`, one transaction). A hand model of that would only check itself, so the tool is a vitest test that drives the real `Registry` against a real SQL engine with `Promise.all` of 2 to 4 callers, over several commands and several seeded start orders. The expected outcome of every scenario is a literal rule in the test, never read back from the registry. A pass covers the commands, call counts and orders listed below, not every interleaving.

There are two engines, and the difference matters:

- **PGlite (default).** The embedded test database has one connection, so it runs one transaction at a time. The test measures this and prints it (`max open transactions 1`). Calls still arrive in different orders and the replay, status and reversal checks still bite, but a missing `FOR UPDATE` cannot show here because nothing ever waits on a lock.
- **A real Postgres server (`FORMAL_DATABASE_URL`).** Transactions run side by side (the run prints `max open transactions 4`). This is the only engine where the lock checks bite and where callers really pass the key lookup together.

## How to run

```bash
pnpm --filter api test:formal
```

- One command, about 15 seconds, runs this check and the Apply scan check (`verify-apply-scan-guard`). Exit 0 means every test passed. `pnpm --filter api test` also runs the file.
- Expected output: `14 passed | 1 skipped` across the four registry files. The skipped test is the natural race that needs a real server.
- `FORMAL_SEED=<n>` changes the start-order seed (default 241). Run a few after a change.

Run the same file on a real server before merging any change to a lock, a transaction or a key path:

```bash
mkdir -p ~/tmp/epg && cd ~/tmp/epg && npm init -y && npm install embedded-postgres@17.5.0-beta.15
B=~/tmp/epg/node_modules/@embedded-postgres/linux-arm64/native/bin   # use the folder for your platform
(cd ~/tmp/epg/node_modules/@embedded-postgres/linux-arm64 && node ./scripts/hydrate-symlinks.js)
$B/initdb -D ~/tmp/epg/pgdata -U postgres --auth=trust -E UTF8
$B/pg_ctl -D ~/tmp/epg/pgdata -o "-p 54329 -k /tmp -c listen_addresses=127.0.0.1" -l ~/tmp/epg/pg.log -w start
FORMAL_DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres pnpm --filter api test:formal
$B/pg_ctl -D ~/tmp/epg/pgdata stop
```

Nothing is added to the repo. The test makes its own database per run and drops it. Expected output there: `15 passed`, and a printed line `transaction order for 4 racing callers: +2 +3 +4 +1 -3 ...` showing the transactions overlapped. If `max open transactions` prints 1 against a real server, the run proved nothing: stop and find out why.

## Tests

| Test (P1 in `registry.formal.test.ts`, P2 in `registry.pending.formal.test.ts`, P3 in `registry.undo.formal.test.ts`) | Covers                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: `job.create`, `paper.create`, `chat.create` one effect per key                                                    | 2 to 4 callers, 3 start orders each, one key. Row count equals one call, one stored key record, every answer identical. `chat.create` writes no activity row, so it covers the `idempotency` table path. Controls: a single call sets the row count, three distinct keys give three effects |
| P1: measures whether the racing transactions really overlap                                                           | Prints the transaction order. On PGlite asserts exactly 1 open transaction, on a server asserts more than 1                                                                                                                                                                                 |
| P1: replays the winner when the command is not inside a transaction (two tests)                                       | A rival writes the key first, then the registry's insert hits the unique index. The replay branch returns the rival's row or stored result                                                                                                                                                  |
| P1: a lost key race inside a transaction replays the winner and drops the loser's effect (two tests)                  | A rival writes the key right after the loser's key lookup, in the same transaction but outside the savepoint. The loser gets the rival's answer and its own effect row is gone                                                                                                              |
| P1: callers that pass the key lookup together all get the replay (server only)                                        | A barrier holds 3 callers inside the command so they all passed the key lookup. Every caller gets one answer, one effect row commits                                                                                                                                                        |
| P2: N racing approves                                                                                                 | 2 to 4 approves of one `job.move` confirmation: one activity row, stage moved once, status `approved`, all callers get one activity id                                                                                                                                                      |
| P2: approve and deny racing never both win                                                                            | 1 or 2 approves with 1 or 2 denies. Final status is `approved` with one effect, or `denied` with none. Every loser is refused with `CONFLICT`                                                                                                                                               |
| P3: N racing undos                                                                                                    | 2 to 4 undos of a `job.create` row: one wins, the rest get `CONFLICT` already undone, the reversal's key is recorded once, the job is gone                                                                                                                                                  |
| P3: an activity row with no reversal                                                                                  | 2 to 4 undos: every one is refused with `CONFLICT` cannot be undone, `undone_at` stays null, no reversal runs                                                                                                                                                                               |

## The fixed finding

Issue #758. Two callers with the same key both passed the key lookup and both ran the command. The second hit the unique index on `(user_id, idempotency_key)`, Postgres aborted its transaction (`25P02`), and the replay lookup in the catch block failed on the aborted transaction, so the caller got a database error instead of the replay.

`execute` now runs the effect and the key write inside `savepoint` (`apps/api/src/db/context.ts`), a nested transaction. A unique violation rolls back only the savepoint, which drops the loser's effect and leaves the command transaction usable, so `replayByKey` reads the winner. A savepoint around the key insert alone is not enough: the loser's effect would stay and commit next to the winner's. The forced tests check the loser's effect row is gone for that reason, and on a real server the natural tests then fail with `expected 2 to be 1` on the job and CV row counts.

No error code is tolerated on either engine. `scripts/expected-failure-issues.test.mjs` rejects an `it.fails` whose title does not cite an open issue, so a pinned finding cannot outlive its issue again.

## How to read a counterexample

The failing label names the scenario: `P1 job.create N=3 seed=242`, `P2 approve x2 deny x1 seed=241`, `P3 undo x4 seed=243`. Rerun with `FORMAL_SEED=<seed>` to repeat the start order.

- `raw database errors` listing `25P02` or `23505` (P1): a caller lost a key race and was not given the replay. Open `Registry.execute`. On PGlite this means the key lookup before the run (`replayByKey`, which reads `activityByKey`, then `idempotencyByKey`) stopped working. On a server, check that the effect still runs inside `savepoint` in `execute` and that the catch below it replays through `replayByKey`.
- `expected 2 to be 1` on a row count (P1): the effect ran twice and committed. Check that the key lookup and the insert are in one transaction.
- `activity rows` or `idempotency rows` not 1 (P1): a command wrote its key twice or not at all.
- P2 `approve and deny racing never both win` with `status: denied` and `moves: 1`: both won. Open `lockPending` (`FOR UPDATE`) and the status checks in `Registry.approve` and `Registry.deny`. This only shows on a real server for a missing lock.
- P3 `callers that undid` not 1: the reversal ran twice or never. Open `lockActivity` and the `undoneAt` check in `Registry.undo`.
- P3 `cannot be undone` expected but a different message: the `reversalCommand` guard in `Registry.undo` is gone or moved after the lookup.
- A failure with a table row mismatch and unchanged registry code means the test rule is wrong. Check it against the state table in the registry before editing code.

## Bounds and assumptions

- Commands: `job.create`, `paper.create`, `chat.create` for keys, `job.move` (Coach confirm) for approve and deny, `job.create` for undo, and three small test commands. Not every command.
- Callers per race: 2 to 4. Start orders: 3 seeds, each caller delayed 0 to 2 event-loop turns. A real server adds its own timing, so each run there may differ.
- One user per scenario. Two users never share a key, because the key is scoped to the user.
- `expireIfStale` (the 24 hour expiry) is not probed.
- The forced tests put the rival row inside the loser's own transaction, right after its key lookup and outside the savepoint, by replacing the first `replayByKey` call. A real rival commits on another connection, and the loser's insert waits for it. The resulting unique violation is the same, and the barrier test shows the natural form on a real server.
- Only `execute`, `approve`, `deny` and `undo` of `Registry` are driven. The HTTP routes and the Coach tool wrapper in `http.ts` are not.

## Undo after a later change (P4)

P4: after act A and a later act B on the same subject, undoing A is refused with `CONFLICT` or leaves B's effect in place. Run `pnpm --filter api test:formal`. Details: [undo-later.md](undo-later.md).

## Coverage record

| Item                                                            | Where                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Registry.execute`                                              | `execute` in `apps/api/src/registry/registry.ts`                                          |
| key lookup before the run                                       | `replayByKey` in `apps/api/src/registry/registry.ts`                                      |
| effect and key write in a savepoint, replay on unique violation | `savepoint(effect)` and its `isUniqueViolation` catch in `execute`                        |
| `replayByKey`                                                   | `replayByKey`, `activityByKey`, `idempotencyByKey` in `apps/api/src/registry/registry.ts` |
| `Registry.approve`                                              | `approve` in `apps/api/src/registry/registry.ts`                                          |
| `Registry.deny`                                                 | `deny` in `apps/api/src/registry/registry.ts`                                             |
| `Registry.undo`                                                 | `undo` in `apps/api/src/registry/registry.ts`                                             |
| `lockPending` (`FOR UPDATE`)                                    | `lockPending` in `apps/api/src/registry/registry.ts`                                      |
| `lockActivity` (`FOR UPDATE`)                                   | `lockActivity` in `apps/api/src/registry/activity-lock.ts`                                |
| `replay`, `replayStored`                                        | `replay`, `replayStored` in `apps/api/src/registry/replay.ts`                             |
| `isUniqueViolation`                                             | `isUniqueViolation` in `apps/api/src/registry/errors.ts`                                  |
| `transaction`, `savepoint`                                      | `transaction`, `savepoint` in `apps/api/src/db/context.ts`                                |
| `Registry.staleExpectation`                                     | `staleExpectation` in `apps/api/src/registry/expectation.ts`                              |
| `GuardedReversal`, `ReversalOf`                                 | `apps/api/src/registry/bind.ts`                                                           |
| `job.move` reversal `expect`                                    | `apps/api/src/job/commands.ts`                                                            |
| `REVERSAL_EXPECT_PENDING`                                       | `apps/api/src/registry/expect-pending.ts`                                                 |
| `activity.reversal_expect`                                      | `apps/api/src/db/schema.ts`, `apps/api/drizzle/0007_activity_reversal_expect.sql`         |

Check files: `apps/api/src/registry/UndoLater.tla` with `.cfg`, mutant configs and `.tla.json` (P4 model), `apps/api/src/registry/registry.undo-later.formal.test.ts` (P4), `apps/api/src/registry/registry.formal.test.ts` (P1), `apps/api/src/registry/registry.pending.formal.test.ts` (P2), `apps/api/src/registry/registry.undo.formal.test.ts` (P3), and the shared engine, trace and race helpers in `apps/api/src/test/registry-formal-support.ts`. Runner: `apps/api/vitest.formal.config.ts`.

Sync commit: `a8bf0fd63246`. Confirm the full hash with `git rev-parse origin/main` when moving it. The first three checks (P1 to P3) were last confirmed at `b618ed9f358b23a280d7c00308aca64474ec36ed`; P4 at the commit above.

## What is not covered

- Interleavings finer than one SQL statement on PGlite. A server run covers them only by chance of timing.
- The pending action edited by a person between proposal and approval.
- The Coach toggles at approve time (`gates.test.ts` covers those) and the expiry path.
- Commands that run without a transaction other than the steered test command (`account.requestEmailChange`).
- Pooled-connection limits, deadlock detection and statement timeouts.

If a later run probes one of these and it fails, it is a new finding. Do not shrink the grammar to hide it.

## When the registry changes

1. Run `pnpm --filter api test:formal`. It is green on trunk, so any failure is a new finding or a wrong rule in the test. Then run it on a real server as above.
2. Fix the registry, never the property or the expected counts, unless a rule disagrees with the registry's documented states.
3. A new keyed command that creates rows needs a row in `KEYED_CASES`. A new terminal state for a pending action or an activity row needs an assertion in the matching P2 or P3 test.
4. Prove the check still bites. Make a scratch change, confirm a named failure, then `git checkout` the file and confirm the run is back to where it started. Useful breaks, each confirmed at the sync commit:
   - Remove the `replayByKey` lookup before the run in `execute`: P1 `one effect per key` fails for all three commands on PGlite.
   - Change the `isUniqueViolation` guard in `execute` to `throw error`: the two `replays the winner when the command is not inside a transaction` tests fail on PGlite.
   - Change `return await savepoint(effect)` in `execute` to `return await effect()`: the two `a lost key race inside a transaction` tests fail on PGlite with `25P02`.
   - Keep `effect()` unwrapped and put `savepoint` around the activity and idempotency inserts alone: the two `a lost key race inside a transaction` tests fail on PGlite with `expected 1 to be +0` (the loser's effect row stayed), and on a real server `one effect per key` fails with `expected 2 to be 1` and the barrier test with `expected 3 to be 1`.
   - Change `if (row.undoneAt) {` in `undo` to `if (false) {`: `N racing undos` fails on PGlite.
   - Change `if (!row.reversalCommand) {` in `undo` to `if (false) {`: `an activity row with no reversal` fails on PGlite.
   - Change the `denied` or the `status !== "pending"` check in `approve` or `deny` to `if (false) {`: `approve and deny racing never both win` fails on PGlite.
   - Remove `.for("update")` in `lockPending`: green on PGlite, and `N racing approves` and `approve and deny racing never both win` fail on a real server.
   - Remove `.for("update")` in `lockActivity`: green on PGlite, and `N racing undos` fails on a real server.
   - Removing the `row.status === "approved"` early return in `approve` changes nothing, because the key lookup in `execute` replays the same row. It is a second guard, not a missing check.
5. Move the sync commit only after you reread every covered function at the new commit, rerun the check on both engines, and confirm every row of the coverage record still describes the code. Then set it to `git rev-parse origin/main` and check that each name in the coverage record still exists.
