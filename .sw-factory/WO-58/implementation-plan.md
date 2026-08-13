# Implementation Plan: WO-58

**Work Order:** WO-58 - Retire Todo and Action Plan features (screens, actions, state)
**Blueprints:** Action Registry & Store

## Why

Both shipped and neither is part of the documented product. Next-step guidance
belongs in the Coach's reply, where it is one concrete thing to do this week,
not in a separate task list the user has to keep tidy alongside the advice.

## What comes out

| Layer | Removed |
|---|---|
| Screens | `/todo`, `/plan`, `components/plan/` |
| Actions | `todo.add/toggle/update/remove`, `plan.toggle/addEntry/updateEntry/removeEntry/moveEntry` |
| Types | `Todo`, `TodoSource`, `PlanEntry`, `PlanStage`, `PlanKind`, `PlanResource` |
| State | `AppState.todos`, `AppState.plan`, and the seeded stage template |
| Copy | the `todo` and `plan` message blocks, `nav.todo`, `nav.plan` |
| Nav | both sidebar rows, the plan sub-nav, the header title entries |

## What stays

The Coach's "one next step" behaviour. It is guidance in a reply, which is what
the work order says to keep.

## The stored rows

A migration, not a wipe. `009_drop_todos_and_plan` removes exactly those two
keys with `jsonb - 'key'`; everything else in the row is the user's real work.
Idempotent, and the down migration restores the shape (not the content, which
was removed rather than archived) so a rolled-back build still reads the row.

`looksLikeState` in both `lib/state/account-state.ts` and
`lib/actions/persistence.ts` stops requiring the two fields, or every existing
row would read as corrupt the moment the migration lands.

## Tests

The removed actions were also the convenient handle several tests used for
"some work in the state". Those move to `profile.addCourse` and `pitch.write`,
which are surviving actions of the same shape. Tests that only existed to check
`todo.*` or `plan.*` behaviour are deleted with the behaviour.
