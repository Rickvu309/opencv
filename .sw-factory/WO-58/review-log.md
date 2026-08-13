# Review Log: WO-58

**Work Order:** WO-58 - Retire Todo and Action Plan features
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. No review subagent:
standing instruction not to spawn subagents unless the user asks.

## Scope

Everything in the In Scope list is gone, verified by grep:

- `/todo`, `/plan`, `components/plan/`
- nine actions: four `todo.*` and five `plan.*`
- `Todo`, `TodoSource`, `PlanEntry`, `PlanStage`, `PlanKind`, `PlanResource`
- `AppState.todos`, `AppState.plan`, `planStageTemplate`
- the `todo` and `plan` message blocks, `nav.todo`, `nav.plan`
- both sidebar rows, the plan sub-nav, and the header title entries

Out of Scope respected: no other registry group touched, and the Coach's "one
next step" behaviour is untouched, since it is a line in a reply rather than a
stored list.

The work order also asks to "verify no remaining feature (Coach starters,
onboarding) references `todos`, `plan`, `todo.*`, or `plan.*`". Both did:

- `lib/coach/starters.ts` chose its opening line by whether the user had todos.
  It now offers the same starter unconditionally.
- `components/coach/replies.ts` told an offline user to "open the plan". Both
  offline replies are rewritten to say something true without it.

## The stored rows

Migration `009_drop_todos_and_plan`, `jsonb - 'key'` on the two keys only.
Applied to the Railway database; `db:status` shows it. The shape checks in
`lib/state/account-state.ts` and `lib/actions/persistence.ts` stopped requiring
the fields in the same change, or every existing row would have read as corrupt
the moment the migration landed. That ordering is the part worth checking twice
and it is what the tests cover.

## Tests

The retired actions were the convenient handle several unrelated tests used for
"some work in the state". Those move to `profile.addCourse` and `pitch.write`,
surviving actions of the same shape, so the tests still test persistence,
context and undo rather than being deleted along with the feature. Tests that
existed only to check `todo.*` or `plan.*` behaviour are deleted with the
behaviour.

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean.
- `npm run build` compiles; `/todo` and `/plan` are no longer in the route list.
- Live against `next dev` with a real account: `/todo` and `/plan` return 404,
  the five surviving app routes return 200, and the rendered sidebar contains
  no link to either.

## Verdict

**APPROVED**
