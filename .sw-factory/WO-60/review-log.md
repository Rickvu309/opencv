# Review Log: WO-60

**Work Order:** WO-60 - Retire Career Map, preserving the Fit Scoring calculator
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. No review subagent:
standing instruction not to spawn subagents unless the user asks.

## Scope

Removed: `/career-map`, `components/career/`, the four `path.*` actions,
`AppState.paths`, the `map` message block, `nav.map`, and the map's own
furniture in `lib/career-graph.ts` (`pathEdges`, `originNode`, `originTitle`,
`youNode`, `destinationNodes`).

**Not removed, and this is the point of the work order:** `lib/career-fit.ts`
is untouched. `pathNodes`, `stages`, `Requirement` and `PathNode` stay, because
Fit Scoring has nothing to score against without them and onboarding has
nothing to offer as a goal.

### The judgement call, stated

The In Scope list says "remove the role-archetype dataset (the hand-authored
nodes/edges in `career-graph`) that only the map consumed". The nodes are not
consumed only by the map: onboarding reads them for its goal picker and its
live fit score. Out of Scope then says, in bold, that the Fit Scoring calculator
must **not** be removed and that onboarding's live fit must still work.

Removing the nodes would satisfy the first sentence and break the second. So the
line is drawn at the map's furniture, and the qualifier "that only the map
consumed" is read as doing real work: the edges and the origin node are gone,
the role catalogue is not. It is now documented in the file as a catalogue
rather than as a map dataset.

## The target role

`path.setTarget` existed because a goal had to be written in two places, the
map's `targetId` and the profile's `targetRole`, and letting them drift meant a
roadmap to a job the user had not picked. With the map gone there is one place
for it, so onboarding writes `profile.setIdentity` and the action that kept the
two in step is gone with the reason for it.

Migration `010_drop_paths` removes the key. Nothing is lost: the target role was
always written to the profile at the same instant.

## Onboarding still works

The work order asks for this to be confirmed before closing. Checked live
against `next dev` with a real account:

- `/onboarding` renders, with the goal question and the role choices in it
  (`Data Analyst Intern`, `Business Analyst` both present in the markup)
- finishing writes the target role to the profile through `profile.setIdentity`
- `lib/career-fit.test.ts` passes unchanged, so the calculator is intact

**Limit:** the live fit *number* is on step two, behind client interaction, and
was not driven by hand. Its inputs (`fitFor`, `rankByFit`, `pathNodes`) are
covered by tests and the panel compiles against them; what is unverified is the
click-through, which needs browser automation this repo does not have.

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean.
- `npm run build` compiles; `/career-map` is out of the route list.
- Live: `/career-map` returns 404, the sidebar has no link to it.

## Verdict

**APPROVED**
