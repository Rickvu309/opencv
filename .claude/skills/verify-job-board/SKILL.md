---
name: verify-job-board
description: Check the Apply board and calendar promises, that a card ends in the column of its last drop whatever order the moves, answers and refetches arrive in, that the calendar puts every event on its local day and hour in the profile zone, and that order keys stay strictly increasing. Use after any change to apps/web/src/features/apply/apply-board.tsx, apply-board-drops.ts, apply-calendar-model.ts, apply-calendar-week.tsx, apply-calendar-month.tsx, to packages/domain/src/job-position.ts, to the job.move command or nextPosition in apps/api/src/job/store.ts, or when asked why a card snapped back, a Monday morning interview vanished from its week, or an evening interview sits in the wrong row.
---

# verify-job-board

## The property

- **J1.** On the Apply board, each card ends in the column of the last drop on it, and the screen shows that column at every step. This holds for any order of: drops, `job.move` answers (cards finish independently), and board reads that start and land while moves are queued.
- **J1b.** The board starts its own refresh only when no move is queued.
- **J2.** The calendar buckets every event by its local day and minute in `PROFILE_ZONE` (Asia/Ho_Chi_Minh). A Monday 06:30 interview is in that Monday's week. A 20:00 interview is drawn at 20:00 in its own row. No hour row is labelled past 23.
- **J3.** `generateKeyBetween` returns a key strictly between its neighbours, never repeats a key, and refuses equal or inverted bounds with a `RangeError`.

## The harm

A card the user dropped snaps back to the column it came from, or a second drop back onto the old column is silently thrown away, so the server ends in a different stage than the user chose. An early interview vanishes from its week. An evening interview is drawn in the wrong row or under a row labelled `24:00`.

## Why this tool

The board promise is about order: drops, answers and reads interleave in many ways, so the check is a small TLA+ model of the move queue (`ApplyPersist.tla`) plus a fast-check run that drives the real pure functions in `apply-board-drops.ts` through random schedules. A component test then replays the one schedule that broke production through the real `ApplyBoard`. The calendar and order-key promises are about values, not order, so there the code is the ground truth: fast-check runs the real functions against an oracle written from first principles (Ho Chi Minh is UTC+7 with no daylight saving). A pass covers the bounds below, not every input.

## How to run

```bash
node scripts/tlc.mjs --all
pnpm --filter web exec vitest run src/features/apply/apply-board-drops.property.test.ts src/features/apply/apply-board-queue.test.tsx src/features/apply/apply-calendar-model.property.test.ts --maxWorkers=2
pnpm --filter @workspace/domain test
```

- `tlc.mjs --all` runs every spec in the repo; the four `ApplyPersist` lines must read `PASS`. Each real config exits 0 and each mutant exits 12. Java and the TLA+ jar are needed (see `scripts/tlc.mjs`).
- The vitest run is about 15 seconds. The domain run is about 1 second.
- Read every TLC result with /statechart (read `~/.claude/skills/statechart/SKILL.md` by path; it is user-invoked) to draw the bug path.

## Tests

| Check                                                   | Covers                                                                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApplyPersist.cfg`                                      | 2 cards, 3 stages, 3 accepted drops. `ShownIsIntent`, `ServerIsIntent`, `RefreshOnlyWhenIdle`                                                                                                         |
| `ApplyPersist.override.cfg`                             | Same with 4 accepted drops                                                                                                                                                                            |
| `apply-board-drops.property.test.ts`                    | 1000 random schedules of up to 60 steps over 3 cards: screen equals last drop at every step, server, read and screen equal it at the end, no refresh while a move is queued                           |
| `apply-board-queue.test.tsx`                            | The real `ApplyBoard` with a held `job.move`: a refetch lands mid-queue and the card stays; a drop back onto the old column is sent and the server ends there                                         |
| `apply-calendar-model.property.test.ts`                 | 2000 to 3000 random instants from 2023 to 2029: event day and minute, week shape, week membership, the server range for a week and a month, deadlines, hour rows and block spans for any start minute |
| `job-position.property.test.ts` (`packages/domain/src`) | 80-step random insert plans, 120 repeated inserts at the front, back and a gap, equal and inverted bounds                                                                                             |

## Mutants

Each must fail its check. Apply by hand, run, then restore.

| Mutant                                                                                                                                         | Where                                                      | Fails                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Remove the `pendingMoves === 0` guard: `refresh: true` in `afterMove`; model `Guard = FALSE`                                                   | `apply-board-drops.ts`, `ApplyPersist.mutant.cfg`          | `starts the board refresh only when no move is queued`; TLC `RefreshOnlyWhenIdle`, exit 12    |
| Show jobs without the pending drops: `return jobs` at the top of `shownJobs`; model `Override = FALSE` (the code as shipped before this check) | `apply-board-drops.ts`, `ApplyPersist.override.mutant.cfg` | `shows every card in the column of its last drop at every step`; TLC `ShownIsIntent`, exit 12 |
| Bucket by UTC date: `day: new Date(job.interviewAt).toISOString().slice(0, 10)`                                                                | `calendarEvents` in `apply-calendar-model.ts`              | the day and minute check and the week membership check                                        |
| Cut the week range at UTC midnight: ``from: `${days[0]}T00:00:00.000Z` `` (the bug fixed in cd78d048)                                          | `rangeFor` in `apply-calendar-model.ts`                    | `asks the server for exactly the local days of the week`                                      |
| Let hour rows run past 23 (the bug found by this check)                                                                                        | `hoursFor` in `apply-calendar-model.ts`                    | `draws every interview inside the hour rows`                                                  |

## How to read a counterexample

- A fast-check failure prints `Counterexample: [[...]]`. Steps are `drop` (card, stage), `commit` (that card's oldest queued move finishes on the server), `refetch` (an outside read starts) and `land` (the read in flight arrives). Replay them in order against `step` in the test.
- `expected 'saved' to be 'applied'` on a shown column: the screen read a column from the cache while the drop was still queued. Look at `shownJobs` and at what `ApplyBoard` passes to `toCards`.
- `refreshedWhileQueued` true: `afterMove` asked for a refresh with a move queued. Look at `allSettled`.
- A drop that never reaches `job.move`: `onDragEnd` compared the target with a stale column. It must compare with the shown column (`data` built from `shownJobs`).
- Calendar counterexamples print the instant as milliseconds. Add 7 hours and read the UTC date and time: that is the local day and minute the code must agree with.
- A TLC trace: read it with /statechart. `Drop`, `Commit`, `Refetch`, `Land` are the actions in `ApplyPersist.tla.json`.

## Bounds and assumptions

- Cards: 2 in TLA+, 3 in fast-check. Stages: 3 in TLA+, the four board columns in fast-check. Accepted drops: 3 or 4 in TLA+, up to 60 steps in fast-check.
- Moves for one card finish in the order they were dropped (the board chains them); different cards finish in any order.
- One read is in flight at a time. A newer read replaces an older one, as TanStack Query does for an invalidate. The board's own refresh keeps going when an outside read starts (the board starts it again if an outside read cancels it).
- No move fails. A failed move is swallowed in `persist`, and the final refresh then shows the server's column; no check covers that path.
- Cards the user drops into the same column they are shown in are ignored, as in `onDragEnd`.
- Calendar: only `PROFILE_ZONE` (Asia/Ho_Chi_Minh, no daylight saving). `dayStart` solves for a zone shift in two passes; a zone with daylight saving is not checked.
- The server side of the calendar (`calendarJobs` in `apps/api/src/job/store.ts`) is read only as "an interview is in range when `from <= at <= to`, a deadline when its midnight UTC is" in the deadline check. The route and the database are not driven.
- The order keys are checked from keys the code itself makes. A right bound that ends in the zero digit has no key between it and its prefix; `generateKeyBetween("0", ...)` style inputs return a key past the bound. No caller produces such a bound (`nextPosition` and the checklist only append), so it is not a failure here.

## Findings of this check

- **Fixed: snap-back and lost drop-back (J1).** A read landing between a drop and its move put the card back in the old column. A drop onto that old column was then ignored, so the server kept the first drop. The board now keeps each pending drop in `apply-board-drops.ts` and shows it over the cache until a read that started after the last move has landed. `apply-board-queue.test.tsx` fails on the old board (`expected 'saved' to be 'applied'`) and passes now.
- **Fixed: hour rows past 23 (J2).** An interview starting after 22:00 made `hoursFor` add rows labelled `24:00` and `25:00`, and drew the block past midnight. Rows now stop at 23 and `blockSpan` clips the block to the grid.
- **Not a bug: equal keys.** `generateKeyBetween(a, a)` throws `RangeError`, on purpose. No caller passes two neighbours; `nextPosition`, the checklist and the undo path pass only an end or a restored key.
- **The `pendingMoves === 0` guard is now hygiene.** With the pending-drop override on, removing the guard no longer changes any column; it only adds reads while moves are queued. The check still holds the guard (`RefreshOnlyWhenIdle`) because the comment in `apply-board.tsx` states it as the design.

## Coverage record

| Item                                                                                                        | Where                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `dropOn`, `afterMove`, `clearSettled`, `shownJobs`                                                          | `apps/web/src/features/apply/apply-board-drops.ts`    |
| `persist`, `refreshBoard`, `onDragEnd`                                                                      | `apps/web/src/features/apply/apply-board.tsx`         |
| `calendarEvents`, `eventsInDays`, `weekDays`, `monthWeeks`, `rangeFor`, `dayStart`, `hoursFor`, `blockSpan` | `apps/web/src/features/apply/apply-calendar-model.ts` |
| `EventBlock`, `WeekGrid`                                                                                    | `apps/web/src/features/apply/apply-calendar-week.tsx` |
| `generateKeyBetween`                                                                                        | `packages/domain/src/job-position.ts`                 |
| `PROFILE_ZONE`, `zonedYmd`                                                                                  | `apps/web/src/features/apply/apply-stages.ts`         |

Model: `apps/web/src/features/apply/ApplyPersist.tla` with `ApplyPersist.cfg`, `ApplyPersist.override.cfg`, their `.mutant.cfg` files and the action map `ApplyPersist.tla.json`.

History the check descends from: cd78d048 (early Monday interviews), debae018 (evening interviews), e9f983aa (calendar tests that read today's date), 76159253 (keyboard drop left the card), 3c21027b (property edits dropped rejected drafts, related only through the shared mock).

Sync commit: `a8bf0fd6`. This is the trunk commit the check was last confirmed against. Move it forward only after you confirm the model and tests still describe the covered files at the new commit.

## What is not covered

- The drag library itself (sensors, overlays) and the pointer path. `onDragEnd` is driven directly.
- Failed moves, and a second tab moving the same card.
- Zones with daylight saving, and the month grid's drawing.
- The route `/api/commands/job.move` and the database.
- Real timing. Reads land in any order in the model, but not partway.
